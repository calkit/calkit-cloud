"""Routes related to authentication."""

import logging
import secrets
from datetime import timedelta
from typing import Annotated, Any

import requests
from app import security, users
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.config import settings
from app.messaging import generate_reset_password_email, send_email
from app.models import Message, NewPassword, Token, UserCreate, UserPublic
from app.security import (
    generate_password_reset_token,
    get_password_hash,
    verify_password_reset_token,
)
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm

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
            user.id, expires_delta=access_token_expires
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

    def resp_text_to_dict(resp_text: str):
        items = resp_text.split("&")
        out = {}
        for item in items:
            key, value = item.split("=")
            out[key] = value
        return out

    logger.info("Requesting GitHub access token")
    resp = requests.get(
        "https://github.com/login/oauth/access_token",
        params=dict(
            code=code,
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
        ),
    )
    # Make sure we got a 200 response, and if so, use the token to fetch
    # user details
    if not resp.status_code == 200:
        raise HTTPException(401, "GitHub authentication failed")
    out = resp_text_to_dict(resp.text)
    # TODO: Store this token for the user so we can make requests on their
    # behalf later, e.g., to get repo contents?
    # Get user information from GitHub
    logger.info("Requesting GitHub user")
    gh_user = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {out['access_token']}"},
    ).json()
    user = users.get_user_by_email(session=session, email=gh_user["email"])
    if user is None:
        user = users.create_user(
            session=session,
            user_create=UserCreate(
                email=gh_user["email"],
                full_name=gh_user["name"],
                github_username=gh_user["login"],
                # Generate random password for this user, which they can reset
                # later
                password=secrets.token_urlsafe(32),
            ),
        )
    if user.github_username != gh_user["login"]:
        # Check that GitHub username matches, else fail?
        raise HTTPException(401, "GitHub usernames do not match")
    if not user.is_active:
        raise HTTPException(401, "User is not active")
    # Lastly, generate an access token for this user
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )
