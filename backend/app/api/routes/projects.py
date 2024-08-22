"""Routes for projects."""

import base64
import functools
import logging
import os
import uuid
from typing import Literal

import app.projects
import requests
import s3fs
import yaml
from app import users
from app.api.deps import CurrentUser, SessionDep
from app.dvc import make_mermaid_diagram
from app.models import (
    Dataset,
    Figure,
    Message,
    Project,
    ProjectCreate,
    ProjectsPublic,
    Question,
    Workflow,
)
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


@router.get("/projects/{owner_name}/{project_name}/git/repo")
def get_project_git_repo(
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
    logger.info(
        f"Received request from {current_user.email} to post "
        f"DVC file MD5 {idx}{md5}"
    )
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    logger.info(f"{current_user.email} requesting to POST data")
    # TODO: Check collaborator access
    if project.owner != current_user:
        raise HTTPException(401)
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
    # TODO: Check collaborator access
    if project.owner != current_user:
        raise HTTPException(401)
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


@router.get("/projects/{owner_name}/{project_name}/dvc/files/md5")
def get_project_dvc_files(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUser,
):
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    if project.owner != current_user:
        raise HTTPException(401)
    # TODO: Return what we're supposed to return


class GitItem(BaseModel):
    name: str
    path: str
    sha: str
    size: int
    url: str
    html_url: str
    git_url: str
    download_url: str | None
    type: str


class GitItemWithContents(GitItem):
    encoding: str
    content: str


@router.get("/projects/{owner_name}/{project_name}/git/contents/{path:path}")
@router.get("/projects/{owner_name}/{project_name}/git/contents")
def get_project_git_contents(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUser,
    path: str | None = None,
    astype: Literal["", ".raw", ".html", ".object"] = "",
) -> list[GitItem] | GitItemWithContents | str:
    token = users.get_github_token(session=session, user=current_user)
    url = f"https://api.github.com/repos/{owner_name}/{project_name}/contents"
    if path is not None:
        url += "/" + path
    logger.info(f"Making request to: {url}")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": f"application/vnd.github{astype}+json",
    }
    resp = requests.get(url, headers=headers)
    logger.info(f"Response status code from GitHub: {resp.status_code}")
    if resp.status_code >= 400:
        logger.info(f"GitHub API call failed: {resp.text}")
        if astype in ["", ".object"]:
            raise HTTPException(resp.status_code, resp.json()["message"])
    if astype in ["", ".object"]:
        return resp.json()
    else:
        return resp.text


@router.get("/projects/{owner_name}/{project_name}/questions")
def get_project_questions(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Question]:
    content = get_project_git_contents(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        path="/.calkit/questions.yaml",
    )
    content = base64.b64decode(content["content"]).decode()
    questions = yaml.safe_load(content)
    # TODO: Ensure these go in the database and use real IDs
    return [
        Question.model_validate(
            q | {"project_id": uuid.uuid4(), "id": uuid.uuid4()}
        )
        for q in questions
    ]


@router.get("/projects/{owner_name}/{project_name}/figures")
def get_project_figures(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Figure]:
    fig = Figure(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        path="figures/something.png",
        title="My cool figure",
        description="This is a cool figure.",
        pipeline="something_figure",
    )
    return [fig]


@router.get("/projects/{owner_name}/{project_name}/datasets")
def get_project_datasets(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Dataset]:
    # TODO: Get real data
    # Read the datasets file
    d = Dataset(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        path="data/something.parquet",
        pipeline="pipeline_that_generates_something",
        tabular=True,
        description="This is a dataset of something.",
    )
    return [d]


@router.post("/projects/{owner_name}/{project_name}/syncs")
def post_project_sync(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
    """Synchronize a project with its Git repo.

    Do we actually need this? It will give us a way to operate if GitHub is
    down, at least in read-only mode.
    Or perhaps we can bidirectionally sync, allowing users to update Calkit
    entities and we'll commit them back on sync.
    It would probably be better to use Git for that, so we can handle
    asynchronous edits with merges.
    """
    # Get and save project questions
    # Figures
    # Datasets
    # Publications
    # TODO: Update files in Git repo with IDs?
    return Message(message="success")


@router.get("/projects/{owner_name}/{project_name}/workflow")
def get_project_workflow(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> Workflow:
    content = get_project_git_contents(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        path="/dvc.yaml",
    )
    content = base64.b64decode(content["content"]).decode()
    dvc_pipeline = yaml.safe_load(content)
    # Generate Mermaid diagram
    mermaid = make_mermaid_diagram(dvc_pipeline)
    return Workflow(
        stages=dvc_pipeline["stages"],
        mermaid=mermaid,
    )
