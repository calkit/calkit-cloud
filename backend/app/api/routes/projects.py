"""Routes for projects."""

import functools
import logging
import os
import uuid
from datetime import UTC

import app.projects
import requests
import s3fs
from app import users, utcnow
from app.api.deps import CurrentUser, SessionDep
from app.config import settings
from app.github import token_resp_text_to_dict
from app.models import Message, Project, ProjectCreate, ProjectsPublic
from app.security import decrypt_secret
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import func, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/projects/owned")
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


@router.post("/projects")
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


@router.get("/projects/{project_id}")
def get_project(
    *, project_id: uuid.UUID, current_user: CurrentUser, session: SessionDep
) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        logger.info(f"Project ID {project_id} not found")
        raise HTTPException(404)
    # TODO: Check for collaborator access
    if project.owner_user_id != current_user.id:
        raise HTTPException(401)
    return project


@router.get("/projects/{owner_name}/{project_name}")
def get_project_by_name(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Project:
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    # TODO: Check for collaborator access
    if project.owner_user_id != current_user.id:
        raise HTTPException(401)
    return project


@router.get("/projects/{owner_name}/{project_name}/github/repo")
def get_project_repo(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUser,
):
    token = users.get_github_token(session=session, user=current_user)
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    repo_name = project.git_repo_url.removeprefix("https://github.com/")
    resp = requests.get(
        f"https://api.github.com/repos/{repo_name}",
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()


def _get_minio_fs(host="minio") -> s3fs.S3FileSystem:
    return s3fs.S3FileSystem(
        endpoint_url=f"http://{host}:9000",
        key="root",
        secret=os.getenv("MINIO_ROOT_PASSWORD"),  # TODO: User lower privs
    )


def _make_data_fpath(project_id: str, idx: str, md5: str) -> str:
    return f"s3://data/project_id={project_id}/{idx}/{md5}"


@router.post("/projects/{owner_name}/{project_name}/dvc/files/md5/{idx}/{md5}")
async def post_project_dvc_file(
    *,
    owner_name: str,
    project_name: str,
    idx: str,
    md5: str,
    session: SessionDep,
    current_user: CurrentUser,
    req: Request,
) -> Message:
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    logger.info(f"{current_user.email} requesting to POST data")
    # TODO: Check if this user has write access to this project
    fs = _get_minio_fs()
    # Create bucket if it doesn't exist
    if not fs.exists("s3://data"):
        fs.makedir("s3://data")
    fpath = _make_data_fpath(project.id, idx, md5)
    with fs.open(fpath, "wb") as f:
        # See https://stackoverflow.com/q/73322065/2284865
        async for chunk in req.stream():
            f.write(chunk)
    return Message(message="Success")


@router.get("/projects/{owner_name}/{project_name}/dvc/files/md5/{idx}/{md5}")
def get_project_dvc_file(
    *,
    owner_name: str,
    project_name: str,
    idx: str,
    md5: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> StreamingResponse:
    logger.info(f"{current_user.email} requesting to GET data")
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    # If file doesn't exist, return 404
    fs = _get_minio_fs()
    fpath = _make_data_fpath(project.id, idx, md5)
    logger.info(f"Checking for {fpath}")
    if not fs.exists(fpath):
        logger.info(f"{fpath} does not exist")
        raise HTTPException(404)

    # TODO: Check if this user has read access to this project
    # Stream the file contents back to the user
    def iterfile():
        with fs.open(fpath, "rb") as f:
            chunker = functools.partial(f.read, 4_000_000)
            for chunk in iter(chunker, b""):
                yield chunk

    return StreamingResponse(iterfile())


class GitTreeItem(BaseModel):
    path: str
    mode: str
    type: str
    size: int | None = None
    sha: str
    url: str


@router.get("/projects/{project_id}/git/files")
def get_project_git_files(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> list[GitTreeItem]:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(404)
    if project.owner != current_user:
        # TODO: Check collaborator access
        raise HTTPException(401)
    token = users.get_github_token(session=session, user=current_user)
    # TODO: We need to know the default branch to use the trees route
    url = (
        "https://api.github.com/repos/"
        f"{project.git_repo_url.removeprefix('https://github.com/')}/"
        "git/trees/main"
    )
    logger.info(f"Making request to: {url}")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(url, headers=headers, params=dict(recursive="true"))
    if not resp.status_code == 200:
        logger.info(f"GitHub API call failed: {resp.text}")
        raise HTTPException(400, resp.text)
    return resp.json()["tree"]


class GitHubBlob(BaseModel):
    sha: str
    node_id: str
    size: int
    url: str
    encoding: str
    content: str


@router.get("/projects/{owner_name}/{project_name}/git/files/{file_sha}")
def get_project_git_file(
    owner_name: str,
    project_name: str,
    file_sha: str,
    session: SessionDep,
    user: CurrentUser,
) -> GitHubBlob:
    token = users.get_github_token(session=session, user=user)
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=user,
    )
    repo_url = project.git_repo_url.removeprefix("https://github.com/")
    logger.info(
        f"Getting file SHA {file_sha} for {user.email} from {repo_url}"
    )
    resp = requests.get(
        f"https://api.github.com/repos/{repo_url}/git/blobs/{file_sha}",
        headers={"Authorization": f"Bearer {token}"},
    )
    logger.info(f"GitHub API response status code: {resp.status_code}")
    if resp.status_code >= 400:
        raise HTTPException(resp.status_code)
    return GitHubBlob.model_validate(resp.json())
