"""Authentication."""

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from app.config import settings
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext

from cryptography.fernet import Fernet

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
SCOPES = ["dvc"]


def create_access_token(
    subject: str | Any, expires_delta: timedelta, scope: str | None = None
) -> str:
    """Create an access token.

    Parameters
    ----------
    subject : str
        The subject for the access token, typically a user ID.
    expires_delta : timedelta
        How long from now the token should expire.
    scope : str, optional
        The scope of the token. If there are multiple, they should be
        space-separated.
    """
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"exp": expire, "sub": str(subject)}
    if scope is not None:
        for s in scope.split():
            if s not in SCOPES:
                raise ValueError(f"{s} is not a valid scope")
        to_encode["scope"] = scope
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=ALGORITHM
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def generate_password_reset_token(email: str) -> str:
    delta = timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
    now = datetime.now(timezone.utc)
    expires = now + delta
    exp = expires.timestamp()
    encoded_jwt = jwt.encode(
        {"exp": exp, "nbf": now, "sub": email},
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    return encoded_jwt


def verify_password_reset_token(token: str) -> str | None:
    try:
        decoded_token = jwt.decode(
            token, settings.SECRET_KEY, algorithms=["HS256"]
        )
        return str(decoded_token["sub"])
    except InvalidTokenError:
        return None


def encrypt_secret(value: str) -> str:
    return Fernet(key=settings.FERNET_KEY).encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    return Fernet(key=settings.FERNET_KEY).decrypt(value.encode()).decode()
