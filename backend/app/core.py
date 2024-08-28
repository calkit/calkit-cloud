"""Core functionality that should to into the top-level namespace."""

import logging
from datetime import UTC, datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CATEGORIES_SINGULAR_TO_PLURAL = {
    "figure": "figures",
    "dataset": "datasets",
    "publication": "publications",
    "environment": "environments",
    "references": "references",
}
CATEGORIES_PLURAL_TO_SINGULAR = {
    v: k for k, v in CATEGORIES_SINGULAR_TO_PLURAL.items()
}


def utcnow():
    return datetime.now(UTC)
