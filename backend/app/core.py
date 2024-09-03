"""Core functionality that should to into the top-level namespace."""

import logging
from datetime import UTC, datetime

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
    "environment": "environments",
    "references": "references",
    "software": "software",
}
CATEGORIES_PLURAL_TO_SINGULAR = {
    v: k for k, v in CATEGORIES_SINGULAR_TO_PLURAL.items()
}


def utcnow():
    return datetime.now(UTC)
