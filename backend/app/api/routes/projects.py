"""Routes for projects."""

import base64
import functools
import logging
import os
import subprocess
import uuid
from typing import Annotated, Literal

import app.projects
import git
import requests
import s3fs
import yaml
from app import users
from app.api.deps import CurrentUser, SessionDep
from app.dvc import make_mermaid_diagram
from app.models import (
    Dataset,
    Figure,
    FigureComment,
    FigureCommentPost,
    Message,
    Project,
    ProjectCreate,
    ProjectsPublic,
    Question,
    Workflow,
)
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
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
        path=".calkit/questions.yaml",
        astype=".raw",
    )
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
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    figs_yaml = get_project_git_contents(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        path=".calkit/figures.yaml",
        astype=".raw",
    )
    figures = yaml.safe_load(figs_yaml)
    # Read the DVC lock file
    # TODO: Handle cases where this doesn't exist
    # Perhaps we need a caching table for git contents
    dvc_lock_yaml = get_project_git_contents(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        path="dvc.lock",
        astype=".raw",
    )
    dvc_lock = yaml.safe_load(dvc_lock_yaml)
    fs = _get_minio_fs()
    # Get the figure content and base64 encode it
    for fig in figures:
        path = fig["path"]
        # Is this in the Git repo, or is it in DVC?
        # If it has a stage defined, it should be able to be identified from
        # the DVC lock file
        if (stage := fig.get("stage")) is not None:
            logger.info(f"Searching for {path} from stage '{stage}'")
            stage_outs = dvc_lock["stages"][stage]["outs"]
            for out in stage_outs:
                if out["path"] == path:
                    # We've found it
                    idx = out["md5"][:2]
                    md5 = out["md5"][2:]
                    fpath = _make_data_fpath(
                        project_id=project.id, idx=idx, md5=md5
                    )
                    with fs.open(fpath, "rb") as f:
                        content = f.read()
                    fig["content"] = base64.b64encode(content).decode()
                    logger.info(
                        f"Figure content is now {len(fig['content'])} long"
                    )
                    kws = {}
                    kws["ResponseContentDisposition"] = (
                        f"filename={os.path.basename(path)}"
                    )
                    url = fs.url(fpath, expires=3600 * 24, **kws)
                    logger.info(f"Generated presigned URL for {path}: {url}")
                    fig["url"] = url
                    break
        else:
            # This is not the output of a DVC pipeline stage
            # First, see if it lives in the Git repo
            # TODO: Handle imported figures
            try:
                content = get_project_git_contents(
                    owner_name=owner_name,
                    project_name=project_name,
                    session=session,
                    current_user=current_user,
                    path=path,
                )
                fig["content"] = content["content"]
            except HTTPException:
                # Looks like it doesn't exist in the repo
                # This must be an imported figure, or it's just tracked in DVC
                # without being the output of a stage
                logger.info(f"{path} does not exist in Git repo")
                # See if we can get the DVC file
                dvc_yaml = get_project_git_contents(
                    owner_name=owner_name,
                    project_name=project_name,
                    session=session,
                    current_user=current_user,
                    path=path + ".dvc",
                    astype=".raw",
                )
                dvc_yaml = yaml.safe_load(dvc_yaml)
                out = dvc_yaml["outs"][0]
                idx = out["md5"][:2]
                md5 = out["md5"][2:]
                fpath = _make_data_fpath(
                    project_id=project.id, idx=idx, md5=md5
                )
                with fs.open(fpath, "rb") as f:
                    content = f.read()
                fig["content"] = base64.b64encode(content).decode()
                logger.info(
                    f"Figure content is now {len(fig['content'])} long"
                )
                kws = {}
                kws["ResponseContentDisposition"] = (
                    f"filename={os.path.basename(path)}"
                )
                url = fs.url(fpath, expires=3600 * 24, **kws)
                logger.info(f"Generated presigned URL for {path}: {url}")
                fig["url"] = url
    return [Figure.model_validate(fig) for fig in figures]


@router.get("/projects/{owner_name}/{project_name}/figures/{figure_path}")
def get_project_figure(
    owner_name: str,
    project_name: str,
    figure_path: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> Figure:
    raise HTTPException(501)


@router.post("/projects/{owner_name}/{project_name}/figures")
def post_project_figure(
    owner_name: str,
    project_name: str,
    path: Annotated[str, Form()],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    current_user: CurrentUser,
    session: SessionDep,
) -> Figure:
    logger.info(
        f"Received figure file {path} with content type: {file.content_type}"
    )
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    if project.owner != current_user:
        raise HTTPException(401)
    # TODO: Check write collaborator access to this project
    # TODO: Make sure a figure with this path doesn't already exist
    # TODO: Handle projects that aren't yet Calkit projects
    figs_yaml = get_project_git_contents(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        path=".calkit/figures.yaml",
        astype=".raw",
    )
    figures = yaml.safe_load(figs_yaml)
    figpaths = [fig["path"] for fig in figures]
    if path in figpaths:
        raise HTTPException(400, "A figure already exists at this path")
    # Add the file to the repo(s) -- we may need to clone it
    # If it already exists, just git pull
    base_dir = f"/tmp/{owner_name}/{project_name}"
    os.makedirs(base_dir, exist_ok=True)
    os.chdir(base_dir)
    # Clone the repo if it doesn't exist -- it will be in a "repo" dir
    access_token = users.get_github_token(session=session, user=current_user)
    git_clone_url = (
        f"https://x-access-token:{access_token}@"
        f"{project.git_repo_url.removeprefix('https://')}.git"
    )
    cloned = False
    if not os.path.isdir("repo"):
        cloned = True
        logger.info(f"Git cloning into {base_dir}")
        subprocess.call(
            ["git", "clone", "--depth", "1", git_clone_url, "repo"]
        )
    os.chdir("repo")
    repo = git.Repo()
    if not cloned:
        logger.info("Updating remote in case token was refreshed")
        repo.remote().set_url(git_clone_url)
        repo.git.pull()
    repo_contents = os.listdir(".")
    logger.info(f"Repo contents: {repo_contents}")
    # Run git config so we make commits as this user
    repo.git.config(["user.name", current_user.full_name])
    repo.git.config(["user.email", current_user.email])
    # Save the file to the desired path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    file_data = file.file.read()
    with open(path, "wb") as f:
        f.write(file_data)
    # Either git add {path} or dvc add {path}
    # If we DVC add, we'll get output like
    # To track the changes with git, run:

    #         git add figures/.gitignore figures/my-figure.png.dvc

    # To enable auto staging, run:

    #         dvc config core.autostage true
    dvc_out = subprocess.check_output(["dvc", "add", path]).decode()
    for line in dvc_out.split("\n"):
        if line.strip().startswith("git add"):
            cmd = line.strip().split()
            logger.info(f"Calling {cmd}")
            repo.git.add(cmd[2:])
    # Update figures.yaml
    figures.append(
        dict(path=path, title=title, description=description, stage=None)
    )
    with open(".calkit/figures.yaml", "w") as f:
        yaml.safe_dump(figures, f)
    repo.git.add(".calkit/figures.yaml")
    # Make a commit
    repo.git.commit(["-m", f"Add figure {path}"])
    # Push to GitHub, and optionally DVC remote if we used it
    repo.git.push(["origin", repo.branches[0].name])
    # TODO: If the DVC remote, we can just put it in the expected location since
    # we'll have the md5 hash in the dvc file
    with open(path + ".dvc") as f:
        dvc_yaml = yaml.safe_load(f)
    md5 = dvc_yaml["outs"][0]["md5"]
    fs = _get_minio_fs()
    fpath = _make_data_fpath(project_id=project.id, idx=md5[:2], md5=md5[2:])
    with fs.open(fpath, "wb") as f:
        f.write(file_data)
    kws = {}
    kws["ResponseContentDisposition"] = f"filename={os.path.basename(path)}"
    url = fs.url(fpath, expires=3600 * 24, **kws)
    return Figure(
        path=path,
        title=title,
        description=description,
        stage=None,
        content=None,
        url=url,
    )


@router.get("/projects/{owner_name}/{project_name}/figure-comments")
def get_figure_comments(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    figure_path: str | None = None,
) -> list[FigureComment]:
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    # TODO: Check that this user has access to this project
    query = select(FigureComment).where(FigureComment.project_id == project.id)
    if figure_path is not None:
        query = query.where(FigureComment.figure_path == figure_path)
    comments = session.exec(query).fetchall()
    return comments


@router.post("/projects/{owner_name}/{project_name}/figure-comments")
def post_figure_comment(
    owner_name: str,
    project_name: str,
    comment_in: FigureCommentPost,
    current_user: CurrentUser,
    session: SessionDep,
) -> FigureComment:
    logger.info(
        f"Received request to post comment to {owner_name}/{project_name}/"
        f"{comment_in.figure_path}: {comment_in.comment}"
    )
    # Does this user have permission to comment on this project?
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    # TODO: Centralize permissions
    if not project.owner == current_user:
        raise HTTPException(401)
    # First we need to make this this figure path exists in this project
    figs_yaml = get_project_git_contents(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        path=".calkit/figures.yaml",
        astype=".raw",
    )
    figures = yaml.safe_load(figs_yaml)
    fig_paths = [fig["path"] for fig in figures]
    if comment_in.figure_path not in fig_paths:
        raise HTTPException(404)
    comment = FigureComment(
        project_id=project.id,
        figure_path=comment_in.figure_path,
        comment=comment_in.comment,
        user_id=current_user.id,
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment


@router.get("/projects/{owner_name}/{project_name}/data")
def get_project_data(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Dataset]:
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    # TODO: Centralize permissions
    if project.owner != current_user:
        raise HTTPException(401)
    # Read the datasets file from the repo
    datasets_yaml = get_project_git_contents(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        path=".calkit/data.yaml",
        astype=".raw",
    )
    datasets = yaml.safe_load(datasets_yaml)
    fs = _get_minio_fs()
    for dataset in datasets:
        # Create a dummy ID
        # TODO: Don't do this -- put in the DB or not
        dataset["id"] = uuid.uuid4()
        dataset["project_id"] = project.id
        # TODO: If this is imported, get title, description, etc. from the
        # source dataset
    return [Dataset.model_validate(d) for d in datasets]


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
        path="dvc.yaml",
        astype=".raw",
    )
    dvc_pipeline = yaml.safe_load(content)
    # Generate Mermaid diagram
    mermaid = make_mermaid_diagram(dvc_pipeline)
    logger.info(
        f"Created Mermaid diagram for {owner_name}/{project_name}:\n{mermaid}"
    )
    return Workflow(
        stages=dvc_pipeline["stages"], mermaid=mermaid, yaml=content
    )
