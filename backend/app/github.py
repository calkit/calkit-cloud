"""GitHub related functionality."""

import os
import time

import jwt
import requests
from fastapi import HTTPException

from app.config import settings


class GitHubAppNotConfigured(Exception):
    """Raised when the GitHub App private key isn't available."""


def _load_app_signing_key() -> bytes:
    """Return the GitHub App private key (PEM) from settings.

    Raises GitHubAppNotConfigured if GH_APP_PRIVATE_KEY isn't set.
    """
    if not settings.GH_APP_PRIVATE_KEY:
        raise GitHubAppNotConfigured(
            "GitHub App private key not configured (set GH_APP_PRIVATE_KEY)"
        )
    # Env vars commonly carry the PEM with escaped newlines; restore them so
    # the key parses whether it was provided escaped or as a real multi-line.
    return settings.GH_APP_PRIVATE_KEY.replace("\\n", "\n").encode()


def create_app_token() -> str:
    client_id = os.environ["GH_CLIENT_ID"]
    signing_key = _load_app_signing_key()
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
        # Include GitHub's status and message so real causes are visible: a
        # 401 ("could not be decoded") means GH_APP_PRIVATE_KEY doesn't match
        # the App for GH_CLIENT_ID; a 404 means the App isn't installed on the
        # repo. Reporting a bare "installation not found" hides the difference.
        raise HTTPException(
            502,
            "Could not look up the Calkit GitHub App installation for "
            f"{owner_name}/{repo_name}: GitHub returned {resp.status_code} "
            f"({resp.text[:200]})",
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
            502,
            "Could not mint a Calkit GitHub App installation token for "
            f"{owner_name}/{repo_name}: GitHub returned {resp.status_code} "
            f"({resp.text[:200]})",
        )
    return resp.json()["token"]


def token_resp_text_to_dict(resp_text: str) -> dict:
    items = resp_text.split("&")
    out = {}
    for item in items:
        key, value = item.split("=")
        out[key] = value
    return out
