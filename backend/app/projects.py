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
    """Fetch a project by owner and name.

    TODO: Don't depend on GitHub URL for this!
    """
    query = select(Project).where(
        Project.git_repo_url
        == f"https://github.com/{owner_name}/{project_name}"
    )
    project = session.exec(query).first()
    if project is None and if_not_exists == "error":
        logger.info(f"Project {owner_name}/{project_name} does not exist")
        raise HTTPException(404)
    return project