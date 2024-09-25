"""Functionality for working with projects"""

import logging
from typing import Literal

from app.models import Project, User
from fastapi import HTTPException
from sqlmodel import Session, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_project(
    session: Session,
    owner_name: str,
    project_name: str,
    if_not_exists: Literal["ignore", "error"] = "error",
    current_user: User = None,
    min_access_level: Literal["read", "write", "admin", "owner"] = "read",
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
    if current_user is not None:
        # Compute access
        # TODO: Collaborator write access
        if project.owner == current_user:
            project.current_user_access = "owner"
        elif project.is_public:
            project.current_user_access = "read"
        else:
            raise HTTPException(403)
        access_levels = {
            level: n
            for (n, level) in enumerate(["read", "write", "admin", "owner"])
        }
        user_has_level = access_levels[project.current_user_access]
        min_level = access_levels[min_access_level]
        if user_has_level < min_level:
            raise HTTPException(403)
    return project
