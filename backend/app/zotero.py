"""Functionality for working with Zotero.

Zotero uses OAuth 1.0a, so requests must be signed with our client key and
secret, and the flow needs three legs: fetch a temporary request token, send
the user to Zotero to approve it, then trade the approved token plus a verifier
for a permanent API key. The signing means the browser can't drive this the way
it does for our OAuth 2 providers.
"""

import logging
from urllib.parse import parse_qsl, urlencode

from fastapi import HTTPException
from requests_oauthlib import OAuth1Session

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "https://api.zotero.org"
REQUEST_TOKEN_URL = "https://www.zotero.org/oauth/request"
AUTHORIZE_URL = "https://www.zotero.org/oauth/authorize"
ACCESS_TOKEN_URL = "https://www.zotero.org/oauth/access"
# Preselect full read/write access to the user's own library, their notes, and
# every group they belong to on Zotero's approval page. The user can still dial
# any of these back before approving.
AUTHORIZE_PARAMS = dict(
    library_access="1",
    notes_access="1",
    write_access="1",
    all_groups="write",
)


def fetch_request_token(callback_uri: str) -> dict[str, str]:
    """Fetch a temporary request token to start the authorization flow."""
    session = OAuth1Session(
        client_key=settings.ZOTERO_CLIENT_KEY,
        client_secret=settings.ZOTERO_CLIENT_SECRET,
        callback_uri=callback_uri,
    )
    resp = session.post(REQUEST_TOKEN_URL, timeout=15)
    logger.info(f"Zotero request token status code: {resp.status_code}")
    if resp.status_code != 200:
        logger.error(f"Failed to fetch Zotero request token: {resp.text}")
        raise HTTPException(resp.status_code, "Failed to reach Zotero")
    token = dict(parse_qsl(resp.text))
    if "oauth_token" not in token or "oauth_token_secret" not in token:
        logger.error(f"Unexpected Zotero request token response: {resp.text}")
        raise HTTPException(502, "Unexpected response from Zotero")
    return token


def create_authorize_url(oauth_token: str) -> str:
    """Create the URL to send the user to in order to approve access."""
    params = AUTHORIZE_PARAMS | dict(oauth_token=oauth_token)
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def fetch_access_token(
    oauth_token: str, oauth_token_secret: str, oauth_verifier: str
) -> dict[str, str]:
    """Trade an approved request token for a permanent API key.

    Zotero returns the API key in ``oauth_token_secret``, alongside the
    ``userID`` and ``username`` of the account that approved access.
    """
    session = OAuth1Session(
        client_key=settings.ZOTERO_CLIENT_KEY,
        client_secret=settings.ZOTERO_CLIENT_SECRET,
        resource_owner_key=oauth_token,
        resource_owner_secret=oauth_token_secret,
        verifier=oauth_verifier,
    )
    resp = session.post(ACCESS_TOKEN_URL, timeout=15)
    logger.info(f"Zotero access token status code: {resp.status_code}")
    if resp.status_code != 200:
        logger.error(f"Failed to fetch Zotero access token: {resp.text}")
        raise HTTPException(
            resp.status_code, "Failed to authenticate with Zotero"
        )
    token = dict(parse_qsl(resp.text))
    if "oauth_token_secret" not in token or "userID" not in token:
        logger.error(f"Unexpected Zotero access token response: {resp.text}")
        raise HTTPException(502, "Unexpected response from Zotero")
    return token
