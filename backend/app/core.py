"""Core functionality that should to into the top-level namespace."""

import logging
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import ruamel.yaml

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ryaml = ruamel.yaml.YAML()
ryaml.indent(mapping=2, sequence=4, offset=2)
ryaml.preserve_quotes = True
ryaml.width = 70

CATEGORIES_SINGULAR_TO_PLURAL = {
    "figure": "figures",
    "dataset": "datasets",
    "publication": "publications",
    "notebook": "notebooks",
    "environment": "environments",
    "references": "references",
    "software": "software",
}
CATEGORIES_PLURAL_TO_SINGULAR = {
    v: k for k, v in CATEGORIES_SINGULAR_TO_PLURAL.items()
}
INVALID_ACCOUNT_NAMES = [
    "datasets",
    "data",
    "figures",
    "figs",
    "publications",
    "pubs",
    "calculations",
    "calcs",
    "environments",
    "envs",
    "software",
    "sw",
    "admin",
    "settings",
    "login",
    "explore",
    "browse",
    "search",
    "organizations",
    "orgs",
    "projects",
    "teams",
    "tasks",
]


def utcnow():
    """Return a timezone-naive timestamp for now in UTC."""
    return datetime.now(UTC).replace(tzinfo=None)


def params_from_url(url: str) -> dict:
    parsed_url = urlparse(url)
    return parse_qs(parsed_url.query)
