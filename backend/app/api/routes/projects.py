import logging
import uuid
from typing import Any

import aiofiles
from app.api.deps import CurrentUser, SessionDep
from app.models import Message, Project, ProjectCreate, ProjectsPublic
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlmodel import col, delete, func, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import os

router = APIRouter()


@router.get("/owned")
def get_owned_projects(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 100,
    offset: int = 0,
) -> ProjectsPublic:
    count_statement = (
        select(func.count())
        .select_from(Project)
        .where(Project.owner_user_id == current_user.id)
    )
    count = session.exec(count_statement).one()
    statement = (
        select(Project)
        .where(Project.owner_user_id == current_user.id)
        .offset(offset)
        .limit(limit)
    )
    projects = session.exec(statement).all()
    return ProjectsPublic(data=projects, count=count)


@router.post("/")
def create_project(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    project_in: ProjectCreate,
) -> Project:
    """Create new project."""
    project = Project.model_validate(
        project_in, update={"owner_user_id": current_user.id}
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.post("/{project_id}/data/files/md5/{idx}/{md5}")
async def post_project_data(
    *,
    project_id: uuid.UUID,
    idx: str,
    md5: str,
    session: SessionDep,
    current_user: CurrentUser,
    req: Request,
) -> Message:
    logger.info(f"{current_user.email} requesting to POST data")
    # TODO: Put this in object storage
    # https://stackoverflow.com/q/73322065/2284865
    async with aiofiles.open(f"/tmp/{md5}", 'wb') as f:
        async for chunk in req.stream():
            await f.write(chunk)
    # Check if this user has write access to this project
    return Message(message="Success")


@router.get("/{project_id}/data/files/md5/{idx}/{md5}")
def get_project_data(
    *,
    project_id: uuid.UUID,
    idx: str,
    md5: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    logger.info(f"{current_user.email} requesting to GET data")
    # If file doesn't exist, return 404
    if not os.path.isfile(f"/tmp/{md5}"):
        raise HTTPException(404)
    # TODO: Check if this user has read access to this project
    # TODO: Stream the file contents back to the user
    return Message(message="Success")
