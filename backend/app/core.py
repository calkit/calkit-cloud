"""Core functionality that should to into the top-level namespace."""

import logging
from datetime import UTC, datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(UTC)
