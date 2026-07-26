"""Functionality for working with Zotero.

Zotero uses OAuth 1.0a, so requests must be signed with our client key and
secret, and the flow needs three legs: fetch a temporary request token, send
the user to Zotero to approve it, then trade the approved token plus a verifier
for a permanent API key. The signing means the browser can't drive this the way
it does for our OAuth 2 providers.
"""

import logging
from urllib.parse import parse_qsl, urlencode

import requests
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
    # Never log response bodies from the token endpoints, since they carry
    # secrets. Log the keys that came back instead.
    if resp.status_code != 200:
        logger.error("Failed to fetch Zotero request token")
        raise HTTPException(resp.status_code, "Failed to reach Zotero")
    token = dict(parse_qsl(resp.text))
    if "oauth_token" not in token or "oauth_token_secret" not in token:
        logger.error(f"Zotero request token response keys: {sorted(token)}")
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
        logger.error("Failed to fetch Zotero access token")
        raise HTTPException(
            resp.status_code, "Failed to authenticate with Zotero"
        )
    token = dict(parse_qsl(resp.text))
    if "oauth_token_secret" not in token or "userID" not in token:
        logger.error(f"Zotero access token response keys: {sorted(token)}")
        raise HTTPException(502, "Unexpected response from Zotero")
    return token


# The Web API is versioned; pin it so response shapes don't shift under us.
API_VERSION = "3"
# Zotero caps a page at 100 items. We paginate to gather everything.
PAGE_LIMIT = 100


def _headers(api_key: str) -> dict[str, str]:
    return {"Zotero-API-Key": api_key, "Zotero-API-Version": API_VERSION}


def _library_prefix(library_type: str, library_id: str) -> str:
    """Build the API path prefix for a library, e.g. ``users/12345``."""
    if library_type == "user":
        return f"users/{library_id}"
    if library_type == "group":
        return f"groups/{library_id}"
    raise HTTPException(400, "library_type must be 'user' or 'group'")


def _get_paginated(url: str, api_key: str, params: dict) -> list[dict]:
    """Follow Zotero's ``Link: rel="next"`` headers, gathering all rows."""
    params = dict(params, limit=PAGE_LIMIT)
    results: list[dict] = []
    next_url: str | None = url
    while next_url is not None:
        resp = requests.get(
            next_url,
            headers=_headers(api_key),
            # Params only apply to the first request; the next URL carries its
            # own query string.
            params=params if next_url == url else None,
            timeout=30,
        )
        if resp.status_code != 200:
            logger.error(f"Zotero GET {url} status {resp.status_code}")
            raise HTTPException(resp.status_code, "Failed to reach Zotero")
        results.extend(resp.json())
        next_url = resp.links.get("next", {}).get("url")
    return results


def get_groups(api_key: str, user_id: str) -> list[dict]:
    """List the groups a user belongs to, each usable as a library."""
    rows = _get_paginated(
        f"{BASE_URL}/users/{user_id}/groups", api_key, params={}
    )
    groups = []
    for row in rows:
        data = row.get("data", {})
        groups.append(
            {
                "library_type": "group",
                "library_id": str(row.get("id") or data.get("id")),
                "name": data.get("name"),
            }
        )
    return groups


def get_collections(
    api_key: str, library_type: str, library_id: str
) -> list[dict]:
    """List a library's collections for the import picker."""
    prefix = _library_prefix(library_type, library_id)
    rows = _get_paginated(
        f"{BASE_URL}/{prefix}/collections", api_key, params={}
    )
    collections = []
    for row in rows:
        data = row.get("data", {})
        collections.append(
            {
                "collection_key": data.get("key"),
                "collection_name": data.get("name"),
                "parent_collection": data.get("parentCollection") or None,
            }
        )
    return collections


def search_items(
    api_key: str,
    library_type: str,
    library_id: str,
    q: str | None = None,
    collection_key: str | None = None,
) -> list[dict]:
    """Search top-level items in a library for the selection UI."""
    prefix = _library_prefix(library_type, library_id)
    if collection_key:
        url = f"{BASE_URL}/{prefix}/collections/{collection_key}/items/top"
    else:
        url = f"{BASE_URL}/{prefix}/items/top"
    params: dict = {}
    if q:
        params["q"] = q
    rows = _get_paginated(url, api_key, params=params)
    items = []
    for row in rows:
        data = row.get("data", {})
        creators = data.get("creators", [])
        first_author = None
        if creators:
            c = creators[0]
            first_author = c.get("lastName") or c.get("name")
        items.append(
            {
                "item_key": data.get("key"),
                "title": data.get("title"),
                "item_type": data.get("itemType"),
                "year": (data.get("date") or "")[:4] or None,
                "first_author": first_author,
            }
        )
    return items


def create_collection(
    api_key: str, library_type: str, library_id: str, name: str
) -> str:
    """Create a collection and return its key."""
    prefix = _library_prefix(library_type, library_id)
    resp = requests.post(
        f"{BASE_URL}/{prefix}/collections",
        headers=_headers(api_key),
        json=[{"name": name}],
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        logger.error(f"Zotero create collection status {resp.status_code}")
        raise HTTPException(resp.status_code, "Failed to create collection")
    successful = resp.json().get("successful", {})
    if not successful:
        failed = resp.json().get("failed", {})
        logger.error(f"Zotero create collection failed keys: {sorted(failed)}")
        raise HTTPException(502, "Zotero did not create the collection")
    return successful["0"]["key"]


def add_items_to_collection(
    api_key: str,
    library_type: str,
    library_id: str,
    collection_key: str,
    item_keys: list[str],
) -> None:
    """Add existing items to a collection.

    Collection membership lives on each item, so we read each item's current
    version, append the collection key, and batch-write the updates. Zotero
    rejects a write whose version is stale, which guards against clobbering a
    concurrent edit.
    """
    prefix = _library_prefix(library_type, library_id)
    updates = []
    for item_key in item_keys:
        resp = requests.get(
            f"{BASE_URL}/{prefix}/items/{item_key}",
            headers=_headers(api_key),
            timeout=30,
        )
        if resp.status_code != 200:
            logger.error(f"Zotero get item status {resp.status_code}")
            raise HTTPException(resp.status_code, "Failed to read Zotero item")
        data = resp.json()["data"]
        collections = data.get("collections", [])
        if collection_key not in collections:
            collections = collections + [collection_key]
        updates.append(
            {
                "key": item_key,
                "version": data["version"],
                "collections": collections,
            }
        )
    if not updates:
        return
    resp = requests.post(
        f"{BASE_URL}/{prefix}/items",
        headers=_headers(api_key),
        json=updates,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        logger.error(f"Zotero add-to-collection status {resp.status_code}")
        raise HTTPException(resp.status_code, "Failed to update Zotero items")
    failed = resp.json().get("failed", {})
    if failed:
        logger.error(f"Zotero add-to-collection failed keys: {sorted(failed)}")
        raise HTTPException(502, "Zotero rejected some item updates")


def get_collection_name(
    api_key: str, library_type: str, library_id: str, collection_key: str
) -> str:
    """Fetch a single collection's display name."""
    prefix = _library_prefix(library_type, library_id)
    resp = requests.get(
        f"{BASE_URL}/{prefix}/collections/{collection_key}",
        headers=_headers(api_key),
        timeout=30,
    )
    if resp.status_code != 200:
        logger.error(f"Zotero get collection status {resp.status_code}")
        raise HTTPException(
            resp.status_code, "Failed to read Zotero collection"
        )
    return resp.json()["data"]["name"]


def get_collection_items_bibtex(
    api_key: str, library_type: str, library_id: str, collection_key: str
) -> tuple[str, int]:
    """Export a collection's items as BibTeX.

    Returns the concatenated BibTeX text and the library version from the
    ``Last-Modified-Version`` header, which is stored as ``last_sync_version``
    so a later sync can request only what changed.
    """
    prefix = _library_prefix(library_type, library_id)
    url = f"{BASE_URL}/{prefix}/collections/{collection_key}/items"
    chunks: list[str] = []
    library_version = 0
    start = 0
    while True:
        resp = requests.get(
            url,
            headers=_headers(api_key),
            params={
                "format": "bibtex",
                "limit": PAGE_LIMIT,
                "start": start,
                "itemType": "-attachment || note",
            },
            timeout=60,
        )
        if resp.status_code != 200:
            logger.error(f"Zotero bibtex export status {resp.status_code}")
            raise HTTPException(
                resp.status_code, "Failed to export from Zotero"
            )
        version_header = resp.headers.get("Last-Modified-Version")
        if version_header is not None:
            library_version = int(version_header)
        text = resp.text.strip()
        if text:
            chunks.append(text)
        total = int(resp.headers.get("Total-Results", 0))
        start += PAGE_LIMIT
        if start >= total:
            break
    return "\n\n".join(chunks) + "\n", library_version
