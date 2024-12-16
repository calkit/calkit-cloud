"""Functionality for working with projects"""

import logging
from typing import Literal

from app.models import Org, Project, User
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
    min_access_level: Literal["read", "write", "admin", "owner"] | None = None,
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
    if min_access_level is not None and current_user is None:
        raise ValueError("Current user must be provided to check access level")
    if current_user is not None:
        # Compute access
        if project.owner == current_user:
            project.current_user_access = "owner"
        elif isinstance(project.owner, Org):
            # Only give access to org owners and admins for now
            # TODO: Allow more fine-grained access
            for org_membership in current_user.org_memberships:
                if (
                    org_membership.org_id == project.owner.account.org_id
                    and org_membership.role_name in ["admin", "owner"]
                ):
                    project.current_user_access = "owner"
                    break
            if project.is_public:
                project.current_user_access = "read"
            if (
                not project.is_public
                and not project.current_user_access == "owner"
            ):
                raise HTTPException(403)
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
