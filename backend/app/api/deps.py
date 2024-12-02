"""Dependencies to use in API routes."""

import logging
from collections.abc import Generator
from datetime import datetime
from functools import partial
from typing import Annotated

import app.stripe as stripe
import jwt
from app import security
from app.config import settings
from app.core import utcnow
from app.db import engine
from app.models import TokenPayload, User, UserToken
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        token_scope = payload.get("scope")
        if token_scope is not None:
            raise HTTPException(403, "Invalid token scope")
        if "token_id" in payload:
            token_id = payload["token_id"]
            token_active = session.exec(
                select(UserToken.is_active).where(UserToken.id == token_id)
            ).first()
            if not token_active:
                raise HTTPException(403, "Token has been deactivated")
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    # Ensure that if this user has a paid subscription, it is valid
    if user.subscription is not None and user.subscription.price > 0:
        # Delete subscription if payment hasn't been received in 5 minutes
        # since transaction started
        if (
            user.subscription.paid_until is None
            and ((utcnow() - user.subscription.created).total_seconds() > 300)
        ) or (
            user.subscription.paid_until is not None
            and user.subscription.paid_until < utcnow()
        ):
            logger.info(f"Checking subscription for {user.email}")
            stripe_cust = stripe.get_customer(user.email)
            if stripe_cust is not None:
                stripe_subs = stripe.get_customer_subscriptions(
                    customer_id=stripe_cust.id, status="active"
                )
            else:
                logger.info(f"No Stripe customer exists for {user.email}")
                stripe_subs = []
            sub_valid = False
            for sub in stripe_subs:
                if sub.current_period_end > utcnow().timestamp():
                    logger.info("Found valid subscription")
                    user.subscription.paid_until = datetime.fromtimestamp(
                        sub.current_period_end
                    )
                    user.subscription.processor_subscription_id = sub.id
                    session.commit()
                    session.refresh(user)
                    sub_valid = True
            if not sub_valid:
                logger.info("Deleting invalid subscription")
                session.delete(user.subscription)
                session.commit()
                session.refresh(user)
    return user


def get_current_user_with_token_scope(
    session: SessionDep, token: TokenDep, scope: str | None = None
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        token_scope = payload.get("scope")
        if token_scope is not None and token_scope != scope:
            raise HTTPException(403, "Invalid token scope")
        if "token_id" in payload:
            token_id = payload["token_id"]
            token_active = session.exec(
                select(UserToken.is_active).where(UserToken.id == token_id)
            ).first()
            if not token_active:
                raise HTTPException(403, "Token has been deactivated")
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserDvcScope = Annotated[
    User, Depends(partial(get_current_user_with_token_scope, scope="dvc"))
]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
