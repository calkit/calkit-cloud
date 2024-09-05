"""Routes for projects."""

import base64
import functools
import logging
import os
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal, Optional

import app.projects
import requests
import s3fs
import yaml
from app import users
from app.api.deps import CurrentUser, SessionDep
from app.core import (
    CATEGORIES_PLURAL_TO_SINGULAR,
    CATEGORIES_SINGULAR_TO_PLURAL,
    ryaml,
)
from app.dvc import make_mermaid_diagram, output_from_pipeline
from app.git import get_ck_info, get_dvc_pipeline, get_repo
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
    User,
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
    # First, check if this user already owns this repo on GitHub
    token = users.get_github_token(session=session, user=current_user)
    headers = {"Authorization": f"Bearer {token}"}
    owner_name, repo_name = project_in.git_repo_url.split("/")[-2:]
    # TODO: Organization access
    if owner_name != current_user.github_username:
        raise HTTPException(403, "You must own this repo to import it")
    url = f"https://api.github.com/repos/{owner_name}/{repo_name}"
    resp = requests.get(url, headers=headers)
    if resp.status_code == 404:
        # If not, create it
        logger.info(f"Creating GitHub repo for {owner_name}: {repo_name}")
        body = {
            "name": repo_name,
            "description": project_in.description,
            "homepage": (
                f"https://calkit.io/{current_user.github_username}/{repo_name}"
            ),
            "private": not project_in.is_public,
            "has_discussions": True,
            "has_issues": True,
            "has_wiki": True,
        }
        resp = requests.post(
            "https://api.github.com/user/repos",
            json=body,
            headers=headers,
        )
        if not resp.status_code == 201:
            logger.warning(f"Failed to create: {resp.json()}")
            try:
                message = resp.json()["errors"][0]["message"].capitalize()
            except:
                message = "Failed to create GitHub repo"
            raise HTTPException(resp.status_code, message)
        resp_json = resp.json()
        logger.info(f"Create GitHub repo with URL: {resp_json['html_url']}")
    elif resp.status_code == 200:
        logger.info(f"Repo exists on GitHub as {owner_name}/{repo_name}")
    logger.info("Adding to database")
    project = Project.model_validate(
        project_in, update={"owner_user_id": current_user.id}
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    # TODO: Create calkit.yaml file, README, DVC init
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


class _ContentsItemBase(BaseModel):
    name: str
    path: str
    type: str | None
    size: int | None
    in_repo: bool
    content: str | None = None
    url: str | None = None
    calkit_object: dict | None = None


class ContentsItem(_ContentsItemBase):
    dir_items: list[_ContentsItemBase] | None = None


@router.get("/projects/{owner_name}/{project_name}/contents/{path:path}")
@router.get("/projects/{owner_name}/{project_name}/contents")
def get_project_contents(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUser,
    path: str | None = None,
    ttl: int | None = 300,
) -> ContentsItem:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Collaborator access
    if project.owner != current_user:
        raise HTTPException(401)
    # Get the repo
    # Note this will make the repo our working directory
    # TODO: Stop using a TTL and rely on latest commit hash
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=ttl
    )
    repo_dir = repo.working_dir
    # Load Calkit entities
    if os.path.isfile(os.path.join(repo_dir, "calkit.yaml")):
        logger.info("Loading calkit.yaml")
        with open(os.path.join(repo_dir, "calkit.yaml")) as f:
            ck_info = yaml.safe_load(f)
    else:
        ck_info = {}
    # Load DVC pipeline and lock files if they exist
    dvc_fpath = os.path.join(repo_dir, "dvc.yaml")
    pipeline = {}
    if os.path.isfile(dvc_fpath):
        with open(dvc_fpath) as f:
            pipeline = yaml.safe_load(f)
    dvc_lock_fpath = os.path.join(repo_dir, "dvc.lock")
    dvc_lock = {}
    if os.path.isfile(dvc_lock_fpath):
        with open(dvc_lock_fpath) as f:
            dvc_lock = yaml.safe_load(f)
    ignore_paths = [".git", ".dvc/cache", ".dvc/tmp", ".dvc/config.local"]
    if path is not None and path in ignore_paths:
        raise HTTPException(404)
    # Let's restructure as a dictionary keyed by path
    ck_objects = {}
    for category, itemlist in ck_info.items():
        if not isinstance(itemlist, list):
            logger.warning(
                f"{owner_name}/{project_name} {category} is not a list"
            )
            continue
        if category not in CATEGORIES_PLURAL_TO_SINGULAR:
            logger.warning(
                f"{owner_name}/{project_name} {category} not understood"
            )
            continue
        for item in itemlist:
            item["kind"] = CATEGORIES_PLURAL_TO_SINGULAR[category]
            ck_objects[item["path"]] = item
    # Find any DVC outs for Calkit objects
    ck_outs = {}
    for p, obj in ck_objects.items():
        stage_name = obj.get("stage")
        if stage_name is None:
            dvc_fp = os.path.join(repo_dir, p + ".dvc")
            if os.path.isfile(dvc_fp):
                with open(dvc_fp) as f:
                    dvo = yaml.safe_load(f)["outs"][0]
                ck_outs[p] = dvo
            else:
                ck_outs[p] = None
        else:
            out = output_from_pipeline(
                path=p, stage_name=stage_name, pipeline=pipeline, lock=dvc_lock
            )
            ck_outs[p] = out
    # See if we're listing off a directory
    if path is None or os.path.isdir(os.path.join(repo_dir, path)):
        # We're listing off the top of the repo
        dirname = "" if path is None else path
        contents = []
        paths = sorted(
            os.listdir(
                repo_dir if path is None else os.path.join(repo_dir, path)
            )
        )
        paths = [os.path.join(dirname, p) for p in paths]
        for p in paths:
            if p in ignore_paths:
                continue
            obj = dict(
                name=os.path.basename(p),
                path=p,
                size=os.path.getsize(os.path.join(repo_dir, p)),
                in_repo=True,
            )
            if os.path.isfile(os.path.join(repo_dir, p)):
                obj["type"] = "file"
            else:
                obj["type"] = "dir"
            if p in ck_objects:
                dvc_out = ck_outs.get(p)
                obj["calkit_object"] = ck_objects[p]
                obj["in_repo"] = False
                if dvc_out is not None:
                    obj["size"] = dvc_out.get("size")
                    obj["type"] = (
                        "dir"
                        if dvc_out.get("md5", "").endswith(".dir")
                        else "file"
                    )
            else:
                obj["calkit_object"] = None
            contents.append(ContentsItem.model_validate(obj))
        for ck_path, ck_obj in ck_objects.items():
            if os.path.dirname(ck_path) == dirname and ck_path not in paths:
                # Read DVC output for this path
                dvc_out = ck_outs.get(ck_path)
                if dvc_out is None:
                    dvc_out = {}
                obj = ContentsItem.model_validate(
                    dict(
                        name=os.path.basename(ck_path),
                        path=ck_path,
                        in_repo=False,
                        size=dvc_out.get("size"),
                        type=(
                            "dir"
                            if dvc_out.get("md5", "").endswith(".dir")
                            else "file"
                        ),
                        calkit_object=ck_obj,
                    )
                )
                contents.append(obj)
        return ContentsItem(
            name=os.path.basename(dirname),
            path=dirname,
            type="dir",
            size=sum([c.size if c.size is not None else 0 for c in contents]),
            dir_items=contents,
            calkit_object=ck_objects.get(path),
            in_repo=os.path.isdir(os.path.join(repo.working_dir, dirname)),
        )
    # We're looking for a file, so let's first check if it exists in the repo,
    # but only if it doesn't exist in the DVC outputs
    if (
        os.path.isfile(os.path.join(repo_dir, path))
        and ck_outs.get(path) is None
    ):
        with open(os.path.join(repo_dir, path), "rb") as f:
            content = f.read()
        return ContentsItem.model_validate(
            dict(
                path=path,
                name=os.path.basename(path),
                size=os.path.getsize(os.path.join(repo_dir, path)),
                type="file",
                in_repo=True,
                content=base64.b64encode(content).decode(),
                calkit_object=ck_objects.get(path),
            )
        )
    # The file isn't in the repo, but maybe it's in the Calkit objects
    elif path in ck_objects:
        dvc_out = ck_outs.get(path)
        if dvc_out is None:
            dvc_out = {}
        size = dvc_out.get("size")
        md5 = dvc_out.get("md5", "")
        dvc_type = "dir" if md5.endswith(".dir") else "file"
        content = None
        url = None
        # Create presigned url
        if md5:
            fs = _get_minio_fs()
            fp = _make_data_fpath(
                project_id=project.id, idx=md5[:2], md5=md5[2:]
            )
            kws = {}
            kws["ResponseContentDisposition"] = (
                f"filename={os.path.basename(path)}"
            )
            url = fs.url(fp, expires=3600 * 24, **kws)
            # Get content is the size is small enough
            if size is not None and size <= 5_000_000 and fs.exists(fp):
                with fs.open(fp, "rb") as f:
                    content = base64.b64encode(f.read()).decode()
        return ContentsItem.model_validate(
            dict(
                path=path,
                name=os.path.basename(path),
                size=size,
                type=dvc_type,
                in_repo=False,
                content=content,
                url=url,
                calkit_object=ck_objects[path],
            )
        )
    else:
        raise HTTPException(404)


@router.put("/projects/{owner_name}/{project_name}/contents/{path:path}")
def put_project_contents(
    owner_name: str,
    project_name: str,
    path: str,
    file: Annotated[UploadFile, File()],
    session: SessionDep,
    current_user: CurrentUser,
) -> ContentsItem:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Collaborator access!
    if project.owner != current_user:
        raise HTTPException(401)
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=300
    )
    dirname = os.path.dirname(path)
    os.makedirs(os.path.join(repo.working_dir, dirname), exist_ok=True)
    with open(os.path.join(repo.working_dir, path), "wb") as f:
        f.write(file.file.read())
    # TODO: If this file is large or of certain type, we should put in DVC?
    repo.git.add(path)
    if repo.git.diff(["--staged", path]):
        repo.git.commit(["-m", f"Upload {path} from web"])
        repo.git.push(["origin", repo.active_branch.name])
    return ContentsItem(
        name=os.path.basename(path),
        path=path,
        type="file",
        size=os.path.getsize(os.path.join(repo.working_dir, path)),
        in_repo=True,
    )


class ContentPatch(BaseModel):
    kind: (
        Literal[
            "figure", "dataset", "publication", "environment", "references"
        ]
        | None
    )
    attrs: dict = {}


@router.patch("/projects/{owner_name}/{project_name}/contents/{path:path}")
def patch_project_contents(
    owner_name: str,
    project_name: str,
    path: str,
    req: ContentPatch,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict | None:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Collaborator access!
    if project.owner != current_user:
        raise HTTPException(401)
    if "path" in req.attrs:
        raise HTTPException(501, "Object path change not supported")
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    ck_fpath = os.path.join(repo.working_dir, "calkit.yaml")
    if os.path.isfile(ck_fpath):
        with open(ck_fpath) as f:
            ck_info = ryaml.load(f)
    else:
        ck_info = {}
    # See if this path exists in any category, in case we are going to change
    # its category
    current_category = None
    current_object = None
    current_index = None
    updated = False
    for category, objlist in ck_info.items():
        for obj in objlist:
            if obj["path"] == path:
                current_category = category
                current_category_singular = CATEGORIES_PLURAL_TO_SINGULAR[
                    current_category
                ]
                current_index = objlist.index(obj)
                # If we're not changing categories, we can update in place
                if req.kind == current_category_singular:
                    obj |= req.attrs
                    current_object = obj
                    updated = True
                else:
                    current_object = objlist.pop(current_index)
                break
    if not updated and req.kind is not None:
        if current_object is None:
            current_object = dict(path=path)
        current_object |= req.attrs
        target_category = CATEGORIES_SINGULAR_TO_PLURAL[req.kind]
        if target_category in ck_info:
            ck_info[target_category].append(current_object)
        else:
            ck_info[target_category] = [current_object]
    # Now it's time to write and commit
    with open(ck_fpath, "w") as f:
        ryaml.dump(ck_info, f)
    git_diff = repo.git.diff("calkit.yaml")
    if not git_diff:
        logger.info("No changes to calkit.yaml detected")
        return current_object
    logger.info("Adding and committing changes to calkit.yaml")
    repo.git.add("calkit.yaml")
    if req.kind is None:
        message = f"Remove {path} from {current_category}"
    elif updated:
        message = f"Update {current_category_singular} {path}"
    else:
        message = f"Add {path} to {target_category}"
    repo.git.commit(["-m", message])
    logger.info("Pushing Git repo")
    repo.git.push(["origin", repo.branches[0].name])
    return current_object


@router.get("/projects/{owner_name}/{project_name}/questions")
def get_project_questions(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Question]:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Handle collaborators
    if project.owner != current_user:
        raise HTTPException(401)
    ck_info = get_ck_info(
        project=project, user=current_user, session=session, ttl=300
    )
    questions = ck_info.get("questions", [])
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
    # TODO: Handle collaborators
    if project.owner != current_user:
        raise HTTPException(401)
    ck_info = get_ck_info(
        project=project, user=current_user, session=session, ttl=300
    )
    figures = ck_info.get("figures", [])
    if not figures:
        return figures
    # Get the figure content and base64 encode it
    for fig in figures:
        item = get_project_contents(
            owner_name=owner_name,
            project_name=project_name,
            session=session,
            current_user=current_user,
            path=fig["path"],
        )
        fig["content"] = item.content
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
    current_user: CurrentUser,
    session: SessionDep,
    path: Annotated[str, Form()],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    stage: Optional[Annotated[str, Form()]] = Form(None),
    file: Optional[Annotated[UploadFile, File()]] = Form(None),
) -> Figure:
    if file is not None:
        logger.info(
            f"Received figure file {path} with content type: "
            f"{file.content_type}"
        )
    else:
        logger.info(f"Received request to create figure from {path}")
    if file is not None and stage is not None:
        raise HTTPException(
            400, "DVC outputs should be uploaded with `dvc push`"
        )
    project = app.projects.get_project(
        session=session, owner_name=owner_name, project_name=project_name
    )
    # TODO: Check write collaborator access to this project
    if project.owner != current_user:
        raise HTTPException(401)
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    # Handle projects that aren't yet Calkit projects
    ck_fpath = os.path.join(repo.working_dir, "calkit.yaml")
    if os.path.isfile(ck_fpath):
        ck_info = ryaml.load(Path(ck_fpath))
    else:
        ck_info = {}
    figures = ck_info.get("figures", [])
    # Make sure a figure with this path doesn't already exist
    figpaths = [fig["path"] for fig in figures]
    if path in figpaths:
        raise HTTPException(400, "A figure already exists at this path")
    if file is not None:
        # Add the file to the repo(s)
        # Save the file to the desired path
        os.makedirs(
            os.path.join(repo.working_dir, os.path.dirname(path)),
            exist_ok=True,
        )
        file_data = file.file.read()
        full_fig_path = os.path.join(repo.working_dir, path)
        with open(full_fig_path, "wb") as f:
            f.write(file_data)
        # Either git add {path} or dvc add {path}
        # If we DVC add, we'll get output like
        # To track the changes with git, run:

        #         git add figures/.gitignore figures/my-figure.png.dvc

        # To enable auto staging, run:

        #         dvc config core.autostage true
        # Initialize DVC if it's never been
        if not os.path.isdir(os.path.join(repo.working_dir, ".dvc")):
            logger.info("Calling dvc init since .dvc directory is missing")
            subprocess.call(["dvc", "init"], cwd=repo.working_dir)
        dvc_out = subprocess.check_output(
            ["dvc", "add", path], cwd=repo.working_dir
        ).decode()
        for line in dvc_out.split("\n"):
            if line.strip().startswith("git add"):
                cmd = line.strip().split()
                logger.info(f"Calling {cmd}")
                repo.git.add(cmd[2:])
    elif not os.path.isfile(os.path.join(repo.working_dir, path)):
        raise HTTPException(
            400, "File must exist in repo if not being uploaded"
        )
    # Update figures
    figures.append(
        dict(path=path, title=title, description=description, stage=stage)
    )
    ck_info["figures"] = figures
    with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    # Make a commit
    repo.git.commit(["-m", f"Add figure {path}"])
    # Push to GitHub, and optionally DVC remote if we used it
    repo.git.push(["origin", repo.branches[0].name])
    url = None
    if file is not None:
        # If using the DVC remote, we can just put it in the expected location
        # since we'll have the md5 hash in the dvc file
        with open(os.path.join(repo.working_dir, path + ".dvc")) as f:
            dvc_yaml = yaml.safe_load(f)
        md5 = dvc_yaml["outs"][0]["md5"]
        fs = _get_minio_fs()
        fpath = _make_data_fpath(
            project_id=project.id, idx=md5[:2], md5=md5[2:]
        )
        with fs.open(fpath, "wb") as f:
            f.write(file_data)
        kws = {}
        kws["ResponseContentDisposition"] = (
            f"filename={os.path.basename(path)}"
        )
        url = fs.url(fpath, expires=3600 * 24, **kws)
        # Finally, remove the figure from the cached repo
        os.remove(full_fig_path)
    return Figure(
        path=path,
        title=title,
        description=description,
        stage=stage,
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
    ck_info = get_ck_info(
        project=project, user=current_user, session=session, ttl=300
    )
    figures = ck_info.get("figures", [])
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
    ck_info = get_ck_info(
        project=project, user=current_user, session=session, ttl=300
    )
    datasets = ck_info.get("datasets", [])
    for dataset in datasets:
        # Create a dummy ID
        # TODO: Don't do this -- put in the DB or not
        dataset["id"] = uuid.uuid4()
        dataset["project_id"] = project.id
        # TODO: If this is imported, get title, description, etc. from the
        # source dataset
    return [Dataset.model_validate(d) for d in datasets]


class Stage(BaseModel):
    cmd: str
    wdir: str | None = None
    deps: list[str] | None = None
    outs: list[str] | None = None
    desc: str | None = None
    meta: dict | None = None


class Publication(BaseModel):
    path: str
    title: str
    description: str | None = None
    type: (
        Literal[
            "journal-article",
            "conference-paper",
            "presentation",
            "poster",
            "report",
            "book",
        ]
        | None
    ) = None
    stage: str | None = None
    content: str | None = None
    stage_info: Stage | None = None


@router.get("/projects/{owner_name}/{project_name}/publications")
def get_project_publications(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Publication]:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Collaborator access
    if project.owner != current_user:
        raise HTTPException(401)
    ck_info = get_ck_info(
        project=project, user=current_user, session=session, ttl=300
    )
    pipeline = get_dvc_pipeline(
        project=project, user=current_user, session=session, ttl=300
    )
    publications = ck_info.get("publications", [])
    resp = []
    for pub in publications:
        if "stage" in pub:
            pub["stage_info"] = pipeline.get("stages", {}).get(pub["stage"])
        # See if we can fetch the content for this publication
        # TODO: This is probably pretty inefficient, since this function
        # reloads the YAML files we just loaded
        try:
            item = get_project_contents(
                owner_name=owner_name,
                project_name=project_name,
                session=session,
                current_user=current_user,
                path=pub["path"],
            )
            pub["content"] = item.content
        except HTTPException as e:
            logger.error(
                f"Failed to get publication object at path {pub['path']}: {e}"
            )
            # Must be a 404
            pass
        resp.append(Publication.model_validate(pub))
    return resp


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
    # First refresh the local cache of the repo
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Collaborator access
    if project.owner != current_user:
        raise HTTPException(401)
    get_repo(project=project, user=current_user, session=session, ttl=None)
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
) -> Workflow | None:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=300
    )
    fpath = os.path.join(repo.working_dir, "dvc.yaml")
    if not os.path.isfile(fpath):
        return
    with open(fpath) as f:
        content = f.read()
    dvc_pipeline = ryaml.load(content)
    # Generate Mermaid diagram
    mermaid = make_mermaid_diagram(dvc_pipeline)
    logger.info(
        f"Created Mermaid diagram for {owner_name}/{project_name}:\n{mermaid}"
    )
    return Workflow(
        stages=dvc_pipeline["stages"], mermaid=mermaid, yaml=content
    )


class Collaborator(BaseModel):
    user_id: uuid.UUID | None = None
    github_username: str
    full_name: str | None = None
    email: str | None = None
    access_level: str


@router.get("/projects/{owner_name}/{project_name}/collaborators")
def get_project_collaborators(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Collaborator]:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Collaborator access
    if project.owner != current_user:
        raise HTTPException(401)
    token = users.get_github_token(session=session, user=current_user)
    url = (
        f"https://api.github.com/repos/{owner_name}/{project_name}/"
        "collaborators"
    )
    resp = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    if not resp.status_code == 200:
        raise HTTPException(resp.status_code, resp.json()["message"])
    resp_json = resp.json()
    collabs = []
    for gh_user in resp_json:
        # TODO: Organization handling
        if gh_user["type"] != "User":
            continue
        user = session.exec(
            select(User).where(User.github_username == gh_user["login"])
        ).first()
        obj = dict(
            github_username=gh_user["login"],
            access_level=gh_user["role_name"],
        )
        if user is not None:
            obj["email"] = user.email
            obj["full_name"] = user.full_name
            obj["user_id"] = user.id
        collabs.append(Collaborator.model_validate(obj))
    return collabs


@router.put(
    "/projects/{owner_name}/{project_name}/collaborators/{github_username}"
)
def put_project_collaborator(
    owner_name: str,
    project_name: str,
    github_username: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    if project.owner != current_user:
        raise HTTPException(401)
    token = users.get_github_token(session=session, user=current_user)
    url = (
        f"https://api.github.com/repos/{owner_name}/{project_name}/"
        f"collaborators/{github_username}"
    )
    resp = requests.put(url, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code >= 400:
        logger.error(
            f"Failed to put collaborator ({resp.status_code}): {resp.text}"
        )
        raise HTTPException(resp.status_code)
    return Message(message="Success")


@router.delete(
    "/projects/{owner_name}/{project_name}/collaborators/{github_username}"
)
def delete_project_collaborator(
    owner_name: str,
    project_name: str,
    github_username: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    if project.owner != current_user:
        raise HTTPException(401)
    token = users.get_github_token(session=session, user=current_user)
    url = (
        f"https://api.github.com/repos/{owner_name}/{project_name}/"
        f"collaborators/{github_username}"
    )
    resp = requests.delete(url, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code >= 400:
        logger.error(
            f"Failed to delete collaborator ({resp.status_code}): {resp.text}"
        )
        raise HTTPException(resp.status_code)
    return Message(message="Success")


class Issue(BaseModel):
    id: int
    number: int
    url: str
    user_github_username: str
    state: Literal["open", "closed"]
    title: str
    body: str | None


@router.get("/projects/{owner_name}/{project_name}/issues")
def get_project_issues(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    page: int = 1,
    per_page: int = 30,
    state: Literal["open", "closed", "all"] = "open",
) -> list[Issue]:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Collaborator access
    if project.owner != current_user:
        raise HTTPException(401)
    token = users.get_github_token(session=session, user=current_user)
    url = f"https://api.github.com/repos/{owner_name}/{project_name}/issues"
    resp = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        params=dict(page=page, per_page=per_page, state=state),
    )
    if not resp.status_code == 200:
        raise HTTPException(resp.status_code, resp.json()["message"])
    resp_json = resp.json()
    # Format these with a defined schema
    resp_fmt = []
    for issue in resp_json:
        resp_fmt.append(
            Issue(
                id=issue["id"],
                number=issue["number"],
                url=issue["html_url"],
                user_github_username=issue["user"]["login"],
                state=issue["state"],
                title=issue["title"],
                body=issue["body"],
            )
        )
    return resp_fmt


class IssuePost(BaseModel):
    title: str
    body: str | None = None


@router.post("/projects/{owner_name}/{project_name}/issues")
def post_project_issue(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    req: IssuePost,
) -> Issue:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Collaborator access
    if project.owner != current_user:
        raise HTTPException(401)
    token = users.get_github_token(session=session, user=current_user)
    url = f"https://api.github.com/repos/{owner_name}/{project_name}/issues"
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}"},
        json=req.model_dump(),
    )
    if resp.status_code != 201:
        logger.error(f"Call to post issue failed ({resp.status_code})")
        raise HTTPException(resp.status_code)
    resp_json = resp.json()
    return Issue.model_validate(
        resp_json
        | dict(
            user_github_username=resp_json["user"]["login"],
            url=resp_json["html_url"],
        )
    )


class IssuePatch(BaseModel):
    state: Literal["open", "closed"]


@router.patch("/projects/{owner_name}/{project_name}/issues/{issue_number}")
def patch_project_issue(
    owner_name: str,
    project_name: str,
    issue_number: int,
    req: IssuePatch,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
    project = get_project_by_name(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
    )
    # TODO: Collaborator access
    if project.owner != current_user:
        raise HTTPException(401)
    token = users.get_github_token(session=session, user=current_user)
    url = (
        f"https://api.github.com/repos/{owner_name}/{project_name}/"
        f"issues/{issue_number}"
    )
    resp = requests.patch(
        url,
        headers={"Authorization": f"Bearer {token}"},
        json=req.model_dump(),
    )
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.json()["message"])
    return Message(message="Success")
