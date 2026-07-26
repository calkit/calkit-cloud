"""Functionality for working with Zotero.

Zotero uses OAuth 1.0a, so requests must be signed with our client key and
secret, and the flow needs three legs: fetch a temporary request token, send
the user to Zotero to approve it, then trade the approved token plus a verifier
for a permanent API key. The signing means the browser can't drive this the way
it does for our OAuth 2 providers.
"""

import html as html_lib
import json
import logging
import os
import re
from urllib.parse import parse_qsl, urlencode

import bibtexparser
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


def get_collection_items(
    api_key: str, library_type: str, library_id: str, collection_key: str
) -> tuple[list[dict], int]:
    """Fetch a collection's top-level items with their BibTeX and data.

    Requesting ``format=json&include=bibtex,data`` returns, per item, its Zotero
    key alongside its rendered BibTeX entry, which is how a BibTeX citekey is
    tied back to its Zotero item (attachments, notes). Returns
    ``(items, library_version)`` where each item is
    ``{item_key, bibtex, data, num_children}``.
    """
    prefix = _library_prefix(library_type, library_id)
    url = f"{BASE_URL}/{prefix}/collections/{collection_key}/items/top"
    items: list[dict] = []
    library_version = 0
    start = 0
    while True:
        resp = requests.get(
            url,
            headers=_headers(api_key),
            params={
                "format": "json",
                "include": "bibtex,data",
                "limit": PAGE_LIMIT,
                "start": start,
            },
            timeout=60,
        )
        if resp.status_code != 200:
            logger.error(f"Zotero items fetch status {resp.status_code}")
            raise HTTPException(resp.status_code, "Failed to read from Zotero")
        version_header = resp.headers.get("Last-Modified-Version")
        if version_header is not None:
            library_version = int(version_header)
        for row in resp.json():
            items.append(
                {
                    "item_key": row.get("key"),
                    "bibtex": (row.get("bibtex") or "").strip(),
                    "data": row.get("data") or {},
                    "num_children": (row.get("meta") or {}).get(
                        "numChildren", 0
                    ),
                }
            )
        total = int(resp.headers.get("Total-Results", 0))
        start += PAGE_LIMIT
        if start >= total:
            break
    return items, library_version


def bib_key_of(bibtex_entry: str) -> str | None:
    """Parse the citekey from a single BibTeX entry string."""
    try:
        entries = bibtexparser.loads(bibtex_entry).entries
    except Exception:
        return None
    return entries[0]["ID"] if entries else None


def _wrap_field(key: str, value: str, width: int = 80) -> list[str]:
    """Render one BibTeX field, hard-wrapping the value at ``width`` columns."""
    opening = f"  {key} = {{"
    indent = " " * len(opening)
    lines: list[str] = []
    cur = opening
    for word in value.split():
        add = word if cur.endswith("{") else " " + word
        # Don't break a single long token (e.g. a URL); only wrap between words.
        if len(cur) + len(add) > width and cur not in (opening, indent):
            lines.append(cur)
            cur = indent + word
        else:
            cur += add
    lines.append(cur + "},")
    return lines


def format_bib(bibtex_text: str) -> str:
    """Reformat BibTeX with 2-space indentation and 80-column wrapping."""
    try:
        db = bibtexparser.loads(bibtex_text)
    except Exception as e:
        logger.warning(f"Failed to parse BibTeX for formatting: {e}")
        return bibtex_text
    blocks: list[str] = []
    for entry in db.entries:
        entry_type = entry.get("ENTRYTYPE", "misc")
        key = entry.get("ID", "")
        lines = [f"@{entry_type}{{{key},"]
        for field, value in entry.items():
            if field in ("ENTRYTYPE", "ID"):
                continue
            text = str(value)
            if "\n" in text:
                # Preserve intentional newlines verbatim (e.g. the Markdown in
                # the comment field); wrapping would corrupt them.
                lines.append(f"  {field} = {{{text}}},")
            else:
                lines.extend(_wrap_field(field, text))
        lines.append("}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks) + "\n"


def note_text_to_html(text: str) -> str:
    """Convert plain text into the simple HTML Zotero stores for notes."""
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    return "".join(
        f"<p>{html_lib.escape(p).replace(chr(10), '<br/>')}</p>"
        for p in paragraphs
    )


def note_html_to_text(html: str) -> str:
    """Convert Zotero note HTML into plain text for editing and display."""
    s = re.sub(r"<\s*br\s*/?>", "\n", html, flags=re.IGNORECASE)
    s = re.sub(r"</\s*p\s*>", "\n\n", s, flags=re.IGNORECASE)
    s = re.sub(r"<[^>]+>", "", s)
    return html_lib.unescape(s).strip()


# Notes are stored in the BibTeX ``comment`` field as plain text, one note per
# section separated by a ``---`` horizontal rule (Zotero notes have no titles).
# This keeps multiple notes self-contained in the .bib and human-readable.
def parse_notes_markdown(comment: str) -> list[dict]:
    """Parse the ``comment`` field into ``[{text}]``, one per ``---`` section."""
    if not comment or not comment.strip():
        return []
    chunks = re.split(r"(?m)^\s*-{3,}\s*$", comment)
    return [{"text": c.strip()} for c in chunks if c.strip()]


def serialize_notes_markdown(notes: list[dict]) -> str:
    """Serialize ``[{text}]`` into ``---``-separated note sections."""
    parts = [(note.get("text") or "").strip() for note in notes]
    return "\n\n---\n\n".join(p for p in parts if p).strip()


def get_item_children(
    api_key: str, library_type: str, library_id: str, item_key: str
) -> list[dict]:
    """Fetch an item's child items (attachments and notes)."""
    prefix = _library_prefix(library_type, library_id)
    resp = requests.get(
        f"{BASE_URL}/{prefix}/items/{item_key}/children",
        headers=_headers(api_key),
        params={"format": "json"},
        timeout=30,
    )
    if resp.status_code != 200:
        logger.error(f"Zotero children fetch status {resp.status_code}")
        raise HTTPException(resp.status_code, "Failed to read Zotero item")
    return resp.json()


def build_item_maps(
    api_key: str, library_type: str, library_id: str, items: list[dict]
) -> tuple[dict, dict]:
    """Build the citekey->item map and citekey->notes map for a collection.

    Only items reporting children are queried, so most items cost no extra
    request. ``items_map`` records the Zotero item key plus its PDF attachment
    and note keys; ``notes_map`` carries each note's HTML for editing.
    """
    items_map: dict = {}
    notes_map: dict = {}
    for it in items:
        bib_key = bib_key_of(it["bibtex"])
        if not bib_key:
            continue
        entry = {
            "item_key": it["item_key"],
            "pdf_attachment_keys": [],
            "note_keys": [],
        }
        if it["num_children"]:
            notes = []
            for child in get_item_children(
                api_key, library_type, library_id, it["item_key"]
            ):
                data = child.get("data", {})
                if (
                    data.get("itemType") == "attachment"
                    and data.get("contentType") == "application/pdf"
                ):
                    entry["pdf_attachment_keys"].append(child["key"])
                elif data.get("itemType") == "note":
                    entry["note_keys"].append(child["key"])
                    notes.append(
                        {
                            "key": child["key"],
                            "version": child.get("version"),
                            "html": data.get("note", ""),
                        }
                    )
            if notes:
                notes_map[bib_key] = notes
        items_map[bib_key] = entry
    return items_map, notes_map


def download_attachment(
    api_key: str, library_type: str, library_id: str, attachment_key: str
) -> tuple[bytes, str]:
    """Download an attachment's file, returning ``(bytes, content_type)``."""
    prefix = _library_prefix(library_type, library_id)
    resp = requests.get(
        f"{BASE_URL}/{prefix}/items/{attachment_key}/file",
        headers=_headers(api_key),
        timeout=120,
        allow_redirects=True,
    )
    if resp.status_code != 200:
        logger.error(f"Zotero attachment download status {resp.status_code}")
        raise HTTPException(resp.status_code, "Failed to download attachment")
    content_type = resp.headers.get("Content-Type", "application/octet-stream")
    return resp.content, content_type


def create_note(
    api_key: str,
    library_type: str,
    library_id: str,
    parent_item_key: str,
    html: str,
) -> dict:
    """Create a note child item under ``parent_item_key``."""
    prefix = _library_prefix(library_type, library_id)
    resp = requests.post(
        f"{BASE_URL}/{prefix}/items",
        headers=_headers(api_key),
        json=[
            {"itemType": "note", "parentItem": parent_item_key, "note": html}
        ],
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        logger.error(f"Zotero create note status {resp.status_code}")
        raise HTTPException(resp.status_code, "Failed to create Zotero note")
    successful = resp.json().get("successful", {})
    if not successful:
        raise HTTPException(502, "Zotero did not create the note")
    created = successful["0"]
    return {"key": created["key"], "version": created["version"]}


def update_note(
    api_key: str,
    library_type: str,
    library_id: str,
    note_key: str,
    version: int,
    html: str,
) -> None:
    """Update a note's HTML, guarding against a stale version."""
    prefix = _library_prefix(library_type, library_id)
    resp = requests.patch(
        f"{BASE_URL}/{prefix}/items/{note_key}",
        headers={
            **_headers(api_key),
            "If-Unmodified-Since-Version": str(version),
        },
        json={"note": html},
        timeout=30,
    )
    if resp.status_code not in (200, 204):
        logger.error(f"Zotero update note status {resp.status_code}")
        raise HTTPException(resp.status_code, "Failed to update Zotero note")


def delete_note(
    api_key: str,
    library_type: str,
    library_id: str,
    note_key: str,
    version: int,
) -> None:
    """Delete a note child item."""
    prefix = _library_prefix(library_type, library_id)
    resp = requests.delete(
        f"{BASE_URL}/{prefix}/items/{note_key}",
        headers={
            **_headers(api_key),
            "If-Unmodified-Since-Version": str(version),
        },
        timeout=30,
    )
    if resp.status_code not in (200, 204):
        logger.error(f"Zotero delete note status {resp.status_code}")
        raise HTTPException(resp.status_code, "Failed to delete Zotero note")


# Local, gitignored Zotero state under .calkit/zotero/ (like Overleaf's
# .calkit/overleaf/). The durable link is committed in calkit.yaml; these files
# hold only local sync bookkeeping and cached item/note metadata.
ZOTERO_DIR = os.path.join(".calkit", "zotero")
SYNC_INFO_REL_PATH = os.path.join(ZOTERO_DIR, "sync.json")
ITEMS_REL_PATH = os.path.join(ZOTERO_DIR, "items.json")


def _read_json(working_dir: str, rel_path: str) -> dict:
    fpath = os.path.join(working_dir, rel_path)
    if not os.path.isfile(fpath):
        return {}
    try:
        with open(fpath) as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to read {rel_path}: {e}")
        return {}


def _write_json(working_dir: str, rel_path: str, data: dict) -> None:
    fpath = os.path.join(working_dir, rel_path)
    os.makedirs(os.path.dirname(fpath), exist_ok=True)
    with open(fpath, "w") as f:
        json.dump(data, f, indent=2)


def read_sync_info(working_dir: str) -> dict:
    return _read_json(working_dir, SYNC_INFO_REL_PATH)


def write_sync_info(working_dir: str, sync_info: dict) -> None:
    _write_json(working_dir, SYNC_INFO_REL_PATH, sync_info)


def read_items_info(working_dir: str) -> dict:
    return _read_json(working_dir, ITEMS_REL_PATH)


def write_items_info(working_dir: str, items_info: dict) -> None:
    _write_json(working_dir, ITEMS_REL_PATH, items_info)
