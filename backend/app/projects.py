"""Functionality for working with projects"""

import logging
from typing import Literal

from app.models import Project
from fastapi import HTTPException
from sqlmodel import Session, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_project(
    session: Session,
    owner_name: str,
    project_name: str,
    if_not_exists: Literal["ignore", "error"] = "error",
) -> Project:
    """Fetch a project by owner and name."""
    query = (
        select(Project)
        .where(Project.owner_account.has(name=owner_name))
        .where(Project.name == project_name)
    )
    project = session.exec(query).first()
    if project is None and if_not_exists == "error":
        logger.info(f"Project {owner_name}/{project_name} does not exist")
        raise HTTPException(404)
    return project
