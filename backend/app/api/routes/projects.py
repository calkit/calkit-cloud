import logging
import os
import uuid

import s3fs
from app.api.deps import CurrentUser, SessionDep
from app.models import Message, Project, ProjectCreate, ProjectsPublic
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlmodel import col, delete, func, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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


@router.get("/{project_id}")
def get_project(
    *, project_id: uuid.UUID, current_user: CurrentUser, session: SessionDep
) -> Project:
    project = session.get(Project, project_id)
    # TODO: Check for collaborator access
    if project.owner_user_id != current_user.id:
        raise HTTPException(401)
    return project


def _get_minio_fs() -> s3fs.S3FileSystem:
    return s3fs.S3FileSystem(
        endpoint_url="http://minio:9000",
        key=os.getenv("MINIO_KEY"),
        secret=os.getenv("MINIO_SECRET"),
    )


def _make_data_fpath(project_id: str, idx: str, md5: str) -> str:
    return f"data/project_id={project_id}/{idx}/{md5}"


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
    # TODO: Check if this user has write access to this project
    # https://stackoverflow.com/q/73322065/2284865
    fs = _get_minio_fs()
    fpath = _make_data_fpath(project_id, idx, md5)
    with fs.open(fpath, "wb") as f:
        async for chunk in req.stream():
            f.write(chunk)
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
    fs = _get_minio_fs()
    fpath = _make_data_fpath(project_id, idx, md5)
    logger.info(f"Checking for {fpath}")
    if not fs.exists(fpath):
        logger.info(f"{fpath} does not exist")
        raise HTTPException(404)
    # TODO: Check if this user has read access to this project
    # TODO: Stream the file contents back to the user
    return Message(message="Success")
