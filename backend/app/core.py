"""Core functionality that should to into the top-level namespace."""

from datetime import UTC, datetime


def utcnow():
    return datetime.now(UTC)
