"""Functionality for working with users."""

import logging
from datetime import datetime, timedelta
from typing import Any

import app.stripe
import requests
from app import logger, utcnow
from app.config import settings
from app.core import INVALID_ACCOUNT_NAMES
from app.github import token_resp_text_to_dict
from app.models import (
    Account,
    User,
    UserCreate,
    UserGitHubToken,
    UserUpdate,
    UserZenodoToken,
)
from app.security import (
    decrypt_secret,
    encrypt_secret,
    get_password_hash,
    verify_password,
)
from fastapi import HTTPException
from sqlmodel import Session, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_user(*, session: Session, user_create: UserCreate) -> User:
    account_name = user_create.account_name or user_create.github_username
    if account_name in INVALID_ACCOUNT_NAMES:
        raise HTTPException(422, "Invalid account name")
    db_obj = User.model_validate(
        user_create,
        update={
            "hashed_password": get_password_hash(user_create.password),
            "account": Account(
                name=account_name,
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
    if user.github_token is None:
        raise HTTPException(401, "User needs to authenticate with GitHub")
    # Refresh token if necessary
    # Should also handle tokens that don't exist?
    if user.github_token.expires <= (utcnow() - timedelta(minutes=5)):
        logger.info("Refreshing GitHub token")
        resp = requests.post(
            "https://github.com/login/oauth/access_token",
            json=dict(
                client_id=settings.GH_CLIENT_ID,
                client_secret=settings.GH_CLIENT_SECRET,
                grant_type="refresh_token",
                refresh_token=decrypt_secret(user.github_token.refresh_token),
            ),
        )
        logger.info("Refreshed GitHub token")
        logger.info(f"GitHub token refresh status code: {resp.status_code}")
        gh_resp = token_resp_text_to_dict(resp.text)
        logger.info(f"GitHub token response keys: {list(gh_resp.keys())}")
        # Handle failure, since all are 200 response codes
        if "error" in gh_resp:
            msg = (
                f"{gh_resp['error']}: "
                f"{gh_resp['error_description'].replace('+', ' ')}"
            )
            logger.error(msg)
            if gh_resp["error"] == "bad_refresh_token":
                logger.info("Deleting bad GitHub token")
                session.delete(user.github_token)
                session.commit()
            raise HTTPException(401, "GitHub token refresh failed")
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


def get_zenodo_token(session: Session, user: User) -> str:
    """Get a user's decrypted Zenodo token, automatically refreshing if
    necessary.
    """
    # Refresh token if necessary
    # Should also handle tokens that don't exist?
    if user.zenodo_token.expires <= utcnow():
        logger.info("Refreshing Zenodo token")
        resp = requests.post(
            "https://zenodo.org/oauth/token",
            data=dict(
                client_id=settings.ZENODO_CLIENT_ID,
                client_secret=settings.ZENODO_CLIENT_SECRET,
                grant_type="refresh_token",
                refresh_token=decrypt_secret(user.zenodo_token.refresh_token),
            ),
        )
        logger.info("Refreshed Zenodo token")
        zenodo_resp = resp.json()
        logger.info(f"Zenodo token response keys: {list(zenodo_resp.keys())}")
        # TODO: Handle failure, since all are 200 response codes
        save_zenodo_token(
            session,
            user=user,
            zenodo_resp=zenodo_resp,
        )
    return decrypt_secret(user.zenodo_token.access_token)


def save_zenodo_token(session: Session, user: User, zenodo_resp: dict):
    now = utcnow()
    expires = now + timedelta(seconds=int(zenodo_resp["expires_in"]))
    if user.zenodo_token is None:
        user.zenodo_token = UserZenodoToken(
            user_id=user.id,
            access_token=encrypt_secret(zenodo_resp["access_token"]),
            refresh_token=encrypt_secret(zenodo_resp["refresh_token"]),
            expires=expires,
        )
    else:
        user.zenodo_token.access_token = encrypt_secret(
            zenodo_resp["access_token"]
        )
        user.zenodo_token.refresh_token = encrypt_secret(
            zenodo_resp["refresh_token"]
        )
        user.zenodo_token.expires = expires
        user.zenodo_token.updated = now
    session.add(user.zenodo_token)
    session.commit()
    session.refresh(user.zenodo_token)


def check_user_subscription_active(session: Session, user: User) -> bool:
    logger.info(f"Checking subscription for {user.email}")
    subscription = user.subscription
    if subscription is None:
        logger.info(f"{user.email} has no subscription")
        return False
    if subscription.plan_id == 0:
        logger.info(f"{user.email} has a free subscription")
        return True
    if (
        subscription.paid_until is not None
        and subscription.paid_until >= utcnow()
    ):
        return True
    # Check with Stripe if the subscription has been paid
    customer = app.stripe.get_customer(email=user.email)
    if customer is None:
        return False
    stripe_subs = app.stripe.get_customer_subscriptions(
        customer_id=customer.id, status="active"
    )
    if not stripe_subs:
        return False
    sub_period_end_timestamps = [sub.current_period_end for sub in stripe_subs]
    subscription.paid_until = datetime.fromtimestamp(
        max(sub_period_end_timestamps)
    )
    session.commit()
    return True
