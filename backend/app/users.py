"""Functionality for working with users."""

import logging
from datetime import datetime, timedelta
from typing import Any

import requests
from fastapi import HTTPException
from requests.exceptions import JSONDecodeError
from sqlmodel import Session, select

import app.stripe
from app import utcnow
from app.config import settings
from app.core import INVALID_ACCOUNT_NAMES
from app.github import token_resp_text_to_dict
from app.models import (
    Account,
    User,
    UserCreate,
    UserGitHubToken,
    UserSubscription,
    UserUpdate,
    UserZenodoToken,
)
from app.security import (
    decrypt_secret,
    encrypt_secret,
    get_password_hash,
    verify_password,
)
from app.zenodo import AUTH_URL as ZENODO_AUTH_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_user(*, session: Session, user_create: UserCreate) -> User:
    account_name = user_create.account_name or user_create.github_username
    if account_name in INVALID_ACCOUNT_NAMES:
        raise HTTPException(422, "Invalid account name")
    user = User.model_validate(
        user_create,
        update={
            "hashed_password": get_password_hash(user_create.password),
            "account": Account(
                name=account_name,
                github_name=user_create.github_username,
            ),  # type: ignore
        },
    )
    # Give the user a free subscription by default
    user.subscription = UserSubscription(
        period_months=1,
        plan_id=0,
        price=0.0,
    )  # type: ignore
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


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
    query = (
        select(UserGitHubToken)
        .where(UserGitHubToken.user_id == user.id)
        .with_for_update()
    )
    token = session.exec(query).first()
    if token is None:
        logger.info(f"{user.email} has no GitHub token")
        raise HTTPException(401, "User needs to authenticate with GitHub")
    # Refresh token if necessary
    # Should also handle tokens that don't exist?
    if (utcnow() + timedelta(minutes=30)) >= token.expires:  # type: ignore
        # Make sure no other process is trying to refresh the token
        # Lock the user token row
        logger.info(f"Refreshing GitHub token for {user.email}")
        resp = requests.post(
            "https://github.com/login/oauth/access_token",
            json=dict(
                client_id=settings.GH_CLIENT_ID,
                client_secret=settings.GH_CLIENT_SECRET,
                grant_type="refresh_token",
                refresh_token=decrypt_secret(token.refresh_token),
            ),
        )
        logger.info(f"GitHub token refresh status code: {resp.status_code}")
        gh_resp = token_resp_text_to_dict(resp.text)
        logger.info(
            f"GitHub token refresh response keys: {list(gh_resp.keys())}"
        )
        # Handle failure, since all are 200 response codes
        if "error" in gh_resp:
            msg = (
                f"{gh_resp['error']}: "
                f"{gh_resp['error_description'].replace('+', ' ')}"
            )
            logger.error(msg)
            if gh_resp["error"] == "bad_refresh_token":
                logger.info(f"Bad refresh token for {user.email}")
                logger.info(f"Deleting bad GitHub token for {user.email}")
                session.delete(token)
                session.commit()
            raise HTTPException(401, "GitHub token refresh failed")
        # Save the newly refreshed token
        now = utcnow()
        expires = now + timedelta(seconds=int(gh_resp["expires_in"]))
        rt_expires = now + timedelta(
            seconds=int(gh_resp["refresh_token_expires_in"])
        )
        token.access_token = encrypt_secret(gh_resp["access_token"])
        token.refresh_token = encrypt_secret(gh_resp["refresh_token"])
        token.expires = expires
        token.refresh_token_expires = rt_expires
        token.updated = now
        user.github_token = token
        session.commit()
    session.commit()
    session.refresh(user.github_token)
    return decrypt_secret(user.github_token.access_token)  # type: ignore


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
    return user.github_token


def get_zenodo_token(session: Session, user: User) -> str:
    """Get a user's decrypted Zenodo token, automatically refreshing if
    necessary.
    """
    if user.zenodo_token is None:
        raise HTTPException(401, "User needs to authenticate with Zenodo")
    # Refresh token if necessary
    # Should also handle tokens that don't exist?
    # TODO: Use with_for_update
    if user.zenodo_token.expires <= utcnow():  # type: ignore
        logger.info(f"Refreshing Zenodo token for {user.email}")
        resp = requests.post(
            ZENODO_AUTH_URL,
            data=dict(
                client_id=settings.ZENODO_CLIENT_ID,
                client_secret=settings.ZENODO_CLIENT_SECRET,
                grant_type="refresh_token",
                refresh_token=decrypt_secret(user.zenodo_token.refresh_token),
            ),
        )
        logger.info(f"Refreshed Zenodo token; status code: {resp.status_code}")
        try:
            zenodo_resp = resp.json()
        except JSONDecodeError:
            zenodo_resp = {}
        logger.info(f"Zenodo token response keys: {list(zenodo_resp.keys())}")
        # Handle failure
        if resp.status_code != 200:
            msg = zenodo_resp.get("error", "Failed to authenticate")
            logger.error(
                f"Failed to refresh Zenodo token for {user.email}: {msg}"
            )
            raise HTTPException(resp.status_code, msg)
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
        )  # type: ignore
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
