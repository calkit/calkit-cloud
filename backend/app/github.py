"""GitHub related functionality."""

import os
import time

from app.models import User
from sqlmodel import Session
from app.users import get_github_token
import requests

import jwt


def create_app_token() -> str:
    pem_fpath = "../../calkit.2024-08-08.private-key.pem"
    client_id = os.environ["GITHUB_CLIENT_ID"]
    # Open PEM
    with open(pem_fpath, "rb") as pem_file:
        signing_key = pem_file.read()
    payload = {
        # Issued at time
        "iat": int(time.time()),
        # JWT expiration time (10 minutes maximum)
        "exp": int(time.time()) + 600,
        # GitHub App's client ID
        "iss": client_id,
    }
    # Create JWT
    encoded_jwt = jwt.encode(payload, signing_key, algorithm="RS256")
    return encoded_jwt


def token_resp_text_to_dict(resp_text: str) -> dict:
    items = resp_text.split("&")
    out = {}
    for item in items:
        key, value = item.split("=")
        out[key] = value
    return out


def make_request_for_user(
    path: str,
    session: Session,
    user: User,
    kind="get",
    astype="",
    **kwargs,
):
    """Make a request to the GitHub API on behalf of a user."""
    token = get_github_token(session=session, user=user)
    func = getattr(requests, kind)
    resp = func(
        f"https://api.github.com" + path,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": f"application/vnd.github{astype}+json",
        },
        **kwargs,
    )
    if astype in ["", ".object"]:
        return resp.json()
    else:
        return resp.text
