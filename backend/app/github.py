"""GitHub related functionality."""

import os
import time

import jwt
import requests
from fastapi import HTTPException


def create_app_token() -> str:
    pem_fpath = "../../calkit.2024-08-08.private-key.pem"
    client_id = os.environ["GH_CLIENT_ID"]
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


def get_app_installation_token(owner_name: str, repo_name: str) -> str:
    """Mint a GitHub App installation access token scoped to one repo.

    Used to perform git operations on behalf of users who have native Calkit
    access to a project but no personal GitHub token (e.g. email/Google
    signups). The caller must have authorized the user's access first.
    """
    app_jwt = create_app_token()
    headers = {
        "Authorization": f"Bearer {app_jwt}",
        "Accept": "application/vnd.github+json",
    }
    resp = requests.get(
        f"https://api.github.com/repos/{owner_name}/{repo_name}/installation",
        headers=headers,
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(
            502,
            "Could not find the Calkit GitHub App installation for this repo",
        )
    installation_id = resp.json()["id"]
    resp = requests.post(
        f"https://api.github.com/app/installations/{installation_id}"
        "/access_tokens",
        headers=headers,
        json={"repositories": [repo_name]},
        timeout=15,
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(
            502, "Could not mint a GitHub App installation token"
        )
    return resp.json()["token"]


def token_resp_text_to_dict(resp_text: str) -> dict:
    items = resp_text.split("&")
    out = {}
    for item in items:
        key, value = item.split("=")
        out[key] = value
    return out
