"""Core functionality that should to into the top-level namespace."""

import csv
import logging
import os
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
    "actions",
    "admin",
    "anonymous",
    "browse",
    "calcs",
    "calculations",
    "checks",
    "create",
    "data",
    "datasets",
    "delete",
    "email",
    "environments",
    "envs",
    "explore",
    "figs",
    "figures",
    "git",
    "github",
    "login",
    "new",
    "notifications",
    "organizations",
    "orgs",
    "pipeline",
    "pipelines",
    "projects",
    "publications",
    "pubs",
    "register",
    "replicate",
    "replications",
    "repro",
    "repros",
    "reproduce",
    "reproductions",
    "search",
    "settings",
    "signup",
    "software",
    "sw",
    "tasks",
    "teams",
    "templates",
    "update",
    "user",
    "users",
    "workflows",
]


def utcnow():
    """Return a timezone-naive timestamp for now in UTC."""
    return datetime.now(UTC).replace(tzinfo=None)


def params_from_url(url: str) -> dict:
    parsed_url = urlparse(url)
    return parse_qs(parsed_url.query)


def read_last_line_from_file(fpath: str) -> str:
    with open(fpath, "rb") as file:
        file.seek(-2, os.SEEK_END)
        while file.read(1) != b"\n":
            file.seek(-2, os.SEEK_CUR)
        last_line = file.readline().decode()
    return last_line


def read_last_line_from_csv(fpath: str) -> list:
    last_line = read_last_line_from_file(fpath)
    row = csv.reader([last_line])
    return list(row)[0]
