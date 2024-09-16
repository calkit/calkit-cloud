"""Dependencies to use in API routes."""

from collections.abc import Generator
from functools import partial
from typing import Annotated

import jwt
from app import security
from app.config import settings
from app.db import engine
from app.models import TokenPayload, User, UserToken
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session, select

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
