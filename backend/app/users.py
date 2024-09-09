"""Functionality for working with users."""

from datetime import UTC, timedelta
from typing import Any

import requests
from app import logger, utcnow
from app.config import settings
from app.github import token_resp_text_to_dict
from app.models import Account, User, UserCreate, UserGitHubToken, UserUpdate
from app.security import (
    decrypt_secret,
    encrypt_secret,
    get_password_hash,
    verify_password,
)
from sqlmodel import Session, select


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create,
        update={
            "hashed_password": get_password_hash(user_create.password),
            "account": Account(
                name=user_create.github_username,
                github_name=user_create.github_username,
            ),
        },
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(
    *, session: Session, db_user: User, user_in: UserUpdate
) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(
    *, session: Session, email: str, password: str
) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user


def get_github_token(session: Session, user: User) -> str:
    """Get a user's decrypted GitHub token, automatically refreshing if
    necessary.
    """
    # Refresh token if necessary
    # Should also handle tokens that don't exist?
    if user.github_token.expires.replace(tzinfo=UTC) <= utcnow():
        logger.info("Refreshing GitHub token")
        resp = requests.post(
            "https://github.com/login/oauth/access_token",
            json=dict(
                client_id=settings.GITHUB_CLIENT_ID,
                client_secret=settings.GITHUB_CLIENT_SECRET,
                grant_type="refresh_token",
                refresh_token=decrypt_secret(user.github_token.refresh_token),
            ),
        )
        logger.info("Refreshed GitHub token")
        gh_resp = token_resp_text_to_dict(resp.text)
        logger.info(f"GitHub token response: {gh_resp}")
        # TODO: Handle failure, since all are 200 response codes
        save_github_token(
            session,
            user=user,
            github_resp=gh_resp,
        )
    return decrypt_secret(user.github_token.access_token)


def save_github_token(
    session: Session, user: User, github_resp: dict
) -> UserGitHubToken:
    now = utcnow()
    expires = now + timedelta(seconds=int(github_resp["expires_in"]))
    rt_expires = now + timedelta(
        seconds=int(github_resp["refresh_token_expires_in"])
    )
    if user.github_token is None:
        user.github_token = UserGitHubToken(
            user_id=user.id,
            access_token=encrypt_secret(github_resp["access_token"]),
            refresh_token=encrypt_secret(github_resp["refresh_token"]),
            expires=expires,
            refresh_token_expires=rt_expires,
        )
    else:
        user.github_token.access_token = encrypt_secret(
            github_resp["access_token"]
        )
        user.github_token.refresh_token = encrypt_secret(
            github_resp["refresh_token"]
        )
        user.github_token.expires = expires
        user.github_token.refresh_token_expires = rt_expires
        user.github_token.updated = now
    session.add(user.github_token)
    session.commit()
    session.refresh(user.github_token)
    return
