"""Routes related to authentication."""

import logging
import secrets
from datetime import timedelta
from typing import Annotated, Any

import jwt
import requests
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from jwt.algorithms import RSAAlgorithm
from jwt.exceptions import InvalidTokenError

from app import mixpanel, security, users
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.config import settings
from app.github import token_resp_text_to_dict
from app.messaging import generate_reset_password_email, send_email
from app.models import (
    Message,
    NewPassword,
    Token,
    UserCreate,
    UserPublic,
)
from app.security import (
    generate_password_reset_token,
    get_password_hash,
    verify_password_reset_token,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/login/access-token")
def login_access_token(
    session: SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    """Get an access token for future requests."""
    user = users.authenticate(
        session=session, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=400, detail="Incorrect email or password"
        )
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return Token(
        access_token=security.create_access_token(
            subject=user.id, expires_delta=access_token_expires
        )
    )


@router.post("/login/test-token")
def test_token(current_user: CurrentUser) -> UserPublic:
    """Test access token."""
    return current_user


@router.post("/password-recovery/{email}")
def recover_password(email: str, session: SessionDep) -> Message:
    user = users.get_user_by_email(session=session, email=email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this email does not exist in the system.",
        )
    password_reset_token = generate_password_reset_token(email=email)
    email_data = generate_reset_password_email(
        email_to=user.email, email=email, token=password_reset_token
    )
    send_email(
        email_to=user.email,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )
    return Message(message="Password recovery email sent")


@router.post("/reset-password/")
def reset_password(session: SessionDep, body: NewPassword) -> Message:
    """Reset password."""
    email = verify_password_reset_token(token=body.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid token")
    user = users.get_user_by_email(session=session, email=email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="A user with this email does not exist in the system.",
        )
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    hashed_password = get_password_hash(password=body.new_password)
    user.hashed_password = hashed_password
    session.add(user)
    session.commit()
    return Message(message="Password updated successfully")


@router.post(
    "/password-recovery-html-content/{email}",
    dependencies=[Depends(get_current_active_superuser)],
    response_class=HTMLResponse,
)
def recover_password_html_content(email: str, session: SessionDep) -> Any:
    """Get HTML content for password recovery."""
    user = users.get_user_by_email(session=session, email=email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="A user with this username does not exist in the system.",
        )
    password_reset_token = generate_password_reset_token(email=email)
    email_data = generate_reset_password_email(
        email_to=user.email, email=email, token=password_reset_token
    )
    return HTMLResponse(
        content=email_data.html_content,
        headers={"subject:": email_data.subject},
    )


@router.get("/login/github")
def login_with_github(code: str, session: SessionDep) -> Token:
    """Log in a user from GitHub authentication, creating a new account if
    necessary.

    The response from GitHub, after parsing into a dictionary, will look
    something like:

    ```
        {'access_token': '...',
        'expires_in': '28800',
        'refresh_token': '...',
        'refresh_token_expires_in': '15897600',
        'scope': '',
        'token_type': 'bearer'}
    ```
    """
    logger.info(f"Requesting GitHub access token with code: {code}")
    resp = requests.get(
        "https://github.com/login/oauth/access_token",
        params=dict(
            code=code,
            client_id=settings.GH_CLIENT_ID,
            client_secret=settings.GH_CLIENT_SECRET,
        ),
    )
    # Make sure we got a 200 response, and if so, use the token to fetch
    # user details
    if not resp.status_code == 200:
        raise HTTPException(400, "GitHub authentication failed")
    out = token_resp_text_to_dict(resp.text)
    if "access_token" not in out:
        raise HTTPException(
            400, f"GitHub authentication failed: {out['error']}"
        )
    logger.info(f"Data from GitHub has keys: {list(out.keys())}")
    # Get user information from GitHub
    logger.info("Requesting GitHub user")
    gh_user = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {out['access_token']}"},
    ).json()
    github_username = gh_user["login"]
    github_email = gh_user["email"]
    logger.info(
        f"Received GitHub user {github_username} with email: {github_email}"
    )
    if github_email is None:
        logger.info("Looking up private GitHub email")
        github_email = requests.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {out['access_token']}"},
        ).json()[0]["email"]
    if settings.ENVIRONMENT == "staging" and github_username not in [
        "petebachant",
        "pbachant",
        "abachant",
    ]:
        logger.warning(
            f"GitHub user {github_username} attempting to log in on staging"
        )
        raise HTTPException(403, "Please log in at calkit.io")
    user = users.get_user_by_email(session=session, email=github_email)
    if user is None:
        logger.info("Creating new user")
        user = users.create_user(
            session=session,
            user_create=UserCreate(
                email=github_email,
                full_name=gh_user["name"],
                github_username=github_username,
                # Generate random password for this user, which they can reset
                # later
                password=secrets.token_urlsafe(16),
            ),
        )
        mixpanel.user_signed_up(user)
    if user.github_username != github_username:
        logger.info("GitHub usernames do not match")
        # Check that GitHub username matches, else fail?
        raise HTTPException(400, "GitHub usernames do not match")
    if not user.is_active:
        logger.info("User is not active")
        raise HTTPException(401, "User is not active")
    # Save the user's GitHub token for later
    users.save_github_token(session=session, user=user, github_resp=out)
    # Lastly, generate an access token for this user
    mixpanel.user_logged_in(user)
    return Token(
        access_token=security.create_access_token(
            subject=user.id,
            expires_delta=timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            ),
        )
    )


@router.post("/login/github-oidc")
def login_with_github_oidc(
    session: SessionDep,
    authorization: str | None = Header(default=None),
) -> Token:
    """Authenticate using an OIDC token from GitHub Actions or Codespaces.

    This endpoint validates the OIDC token from GitHub Actions or GitHub
    Codespaces and returns a Calkit access token. The OIDC token's claims
    are verified to ensure it's from a trusted repository.

    The token must be provided in the Authorization header as: "Bearer <token>"

    For GitHub Actions, the token should be obtained using:

    ```yaml
    permissions:
      id-token: write
    ```

    For GitHub Codespaces, the token is available via the
    ACTIONS_ID_TOKEN_REQUEST_URL environment variable.
    """
    # Extract token from Authorization header
    if not authorization:
        raise HTTPException(
            400, "Authorization header with Bearer token is required"
        )
    if not authorization.startswith("Bearer "):
        raise HTTPException(400, "Authorization header must use Bearer scheme")
    token = authorization[7:]  # Remove "Bearer " prefix
    if not token:
        raise HTTPException(400, "OIDC token cannot be empty")
    logger.info("Validating GitHub OIDC token")
    # Supported GitHub OIDC token issuers
    github_actions_issuer = "https://token.actions.githubusercontent.com"
    github_codespaces_issuer = "https://vstoken.actions.githubusercontent.com"
    try:
        # First, decode without verification to get the header and claims
        unverified_header = jwt.get_unverified_header(token)
        unverified_claims = jwt.decode(
            token, options={"verify_signature": False}
        )
        issuer = unverified_claims.get("iss")
        logger.info(f"OIDC token issuer: {issuer}")
        logger.info(f"OIDC token subject: {unverified_claims.get('sub')}")
        logger.info(
            f"OIDC token repository: {unverified_claims.get('repository')}"
        )
        # Verify the issuer is from GitHub Actions or Codespaces
        if issuer not in [github_actions_issuer, github_codespaces_issuer]:
            raise HTTPException(400, "Invalid OIDC token issuer")
        # Determine if this is from Actions or Codespaces
        is_codespace = issuer == github_codespaces_issuer
        source = "Codespace" if is_codespace else "GitHub Actions"
        logger.info(f"Authenticating from {source}")
        # Get GitHub's OIDC JWKS (JSON Web Key Set) to verify the signature
        jwks_url = f"{issuer}/.well-known/jwks"
        jwks_response = requests.get(jwks_url)
        if jwks_response.status_code != 200:
            raise HTTPException(500, "Failed to fetch GitHub JWKS")
        jwks = jwks_response.json()
        # Find the key matching the token's kid (key ID)
        kid = unverified_header.get("kid")
        signing_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                signing_key = key
                break
        if not signing_key:
            raise HTTPException(400, "Unable to find signing key")
        # Convert JWK to PEM format for PyJWT
        public_key = RSAAlgorithm.from_jwk(signing_key)
        # Verify and decode the token with signature validation
        # Use the domain as the audience
        claims = jwt.decode(
            token,
            key=public_key,  # type: ignore
            algorithms=["RS256"],
            audience=settings.DOMAIN,
            issuer=issuer,
        )
        logger.info(
            f"Successfully validated OIDC token for repository: "
            f"{claims.get('repository')}"
        )
        # Extract repository information
        repository = claims.get("repository")  # e.g., "owner/repo"
        repository_owner = claims.get("repository_owner")
        # The 'actor' claim is the GitHub username of the user who triggered
        # the workflow, which works for both user-owned and org-owned repos
        actor = claims.get("actor")
        # Log Codespace-specific information if available
        if is_codespace:
            codespace_name = unverified_claims.get("codespace_name")
            logger.info(f"Codespace name: {codespace_name}")
        if not repository:
            raise HTTPException(400, "Repository claim not found in token")
        # Use actor as the GitHub username (person who triggered the workflow)
        # This works for both user-owned and org-owned repositories
        github_username = actor or repository_owner
        if not github_username:
            raise HTTPException(
                400, "Neither actor nor repository_owner found in token"
            )
        logger.info(
            f"Looking up user for GitHub username: {github_username} "
            f"(repository: {repository}, owner: {repository_owner})"
        )
        # Find the user by GitHub username
        user = users.get_user_by_github_username(
            session=session, github_username=github_username
        )
        if not user:
            logger.warning(
                f"No user found for GitHub username: {github_username}"
            )
            raise HTTPException(
                404,
                f"No user associated with GitHub account: {github_username}",
            )
        if not user.is_active:
            logger.info(f"User {user.email} is not active")
            raise HTTPException(401, "User is not active")
        # Generate access token with different expiration based on source
        if is_codespace:
            # Longer expiration for interactive Codespace sessions
            access_token_expires = timedelta(hours=8)
            logger.info(
                f"Generating 8-hour access token for {user.email} "
                f"from Codespace"
            )
        else:
            # Shorter expiration for CI/CD workflows
            access_token_expires = timedelta(minutes=60)
            workflow = claims.get("workflow")
            logger.info(
                f"Generating 1-hour access token for {user.email} "
                f"from workflow: {workflow}"
            )
        return Token(
            access_token=security.create_access_token(
                subject=user.id,
                expires_delta=access_token_expires,
            )
        )
    except InvalidTokenError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise HTTPException(400, f"Invalid OIDC token: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating OIDC token: {str(e)}")
        raise HTTPException(500, f"Failed to validate OIDC token: {str(e)}")
