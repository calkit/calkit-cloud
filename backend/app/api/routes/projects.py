"""Routes for projects."""

import base64
import functools
import hashlib
import logging
import os
import subprocess
import uuid
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal, Optional

import app.projects
import bibtexparser
import gcsfs
import requests
import s3fs
import yaml
from app import users
from app.api.deps import CurrentUser, CurrentUserDvcScope, SessionDep
from app.config import settings
from app.core import (
    CATEGORIES_PLURAL_TO_SINGULAR,
    CATEGORIES_SINGULAR_TO_PLURAL,
    params_from_url,
    ryaml,
)
from app.dvc import make_mermaid_diagram, output_from_pipeline
from app.git import (
    get_ck_info,
    get_ck_info_from_repo,
    get_dvc_pipeline,
    get_repo,
)
from app.models import (
    Dataset,
    DatasetDVCImport,
    Figure,
    FigureComment,
    FigureCommentPost,
    FileLock,
    Message,
    Org,
    Project,
    ProjectCreate,
    ProjectPublic,
    ProjectsPublic,
    Question,
    User,
    Workflow,
)
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from google.cloud import storage as gcs
from pydantic import BaseModel
from sqlmodel import Session, func, or_, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

RETURN_CONTENT_SIZE_LIMIT = 1_000_000


@router.get("/projects")
def get_projects(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 100,
    offset: int = 0,
) -> ProjectsPublic:
    # TODO: Handle collaborator access in addition to public
    count_query = (
        select(func.count())
        .select_from(Project)
        .where(
            or_(
                Project.is_public,
                Project.owner_account_id == current_user.account.id,
            )
        )
    )
    count = session.exec(count_query).one()
    select_query = (
        select(Project)
        .where(
            or_(
                Project.is_public,
                Project.owner_account_id == current_user.account.id,
            )
        )
        .limit(limit)
        .offset(offset)
    )
    projects = session.exec(select_query).all()
    return ProjectsPublic(data=projects, count=count)


@router.get("/user/projects")
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
        .where(Project.owner_account_id == current_user.account.id)
    )
    count = session.exec(count_statement).one()
    statement = (
        select(Project)
        .where(Project.owner_account_id == current_user.account.id)
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
) -> ProjectPublic:
    """Create new project."""
    # First, check if this user already owns this repo on GitHub
    token = users.get_github_token(session=session, user=current_user)
    headers = {"Authorization": f"Bearer {token}"}
    owner_name, repo_name = project_in.git_repo_url.split("/")[-2:]
    repo_html_url = f"https://github.com/{owner_name}/{repo_name}"
    repo_api_url = f"https://api.github.com/repos/{owner_name}/{repo_name}"
    resp = requests.get(repo_api_url, headers=headers)
    # Check if the repo is already associated with a project
    query = select(Project).where(Project.git_repo_url == repo_html_url)
    project = session.exec(query).first()
    git_repo_url_is_occupied = project is not None
    if git_repo_url_is_occupied:
        raise HTTPException(409, "Repos can only be associated with 1 project")
    elif resp.status_code == 404:
        if owner_name != current_user.github_username:
            raise HTTPException(403, "Can only create new repos for yourself")
        # If not owned, create it
        logger.info(f"Creating GitHub repo for {owner_name}: {repo_name}")
        body = {
            "name": repo_name,
            "description": project_in.description,
            "homepage": f"https://calkit.io/{owner_name}/{repo_name}",
            "private": not project_in.is_public,
            "has_discussions": True,
            "has_issues": True,
            "has_wiki": True,
            "gitignore_template": "Python",
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
        logger.info(f"Created GitHub repo with URL: {resp_json['html_url']}")
        project = Project.model_validate(
            project_in, update={"owner_account_id": current_user.account.id}
        )
        # Clone the repo and setup the Calkit DVC remote
        repo = get_repo(
            project=project,
            session=session,
            user=current_user,
        )
        # Add to the README
        logger.info("Creating README.md")
        with open(os.path.join(repo.working_dir, "README.md"), "w") as f:
            txt = f"# {project_in.title}\n"
            if project_in.description is not None:
                txt += f"\n{project_in.description}\n"
            f.write(txt)
        repo.git.add("README.md")
        # Setup the DVC remote
        logger.info("Running DVC init")
        subprocess.call(["dvc", "init"], cwd=repo.working_dir)
        logger.info("Enabling DVC autostage")
        subprocess.call(
            ["dvc", "config", "core.autostage", "true"], cwd=repo.working_dir
        )
        logger.info("Setting up default DVC remote")
        base_url = "https://api.calkit.io"
        remote_url = f"{base_url}/projects/{project.name}/dvc"
        subprocess.call(
            ["dvc", "remote", "add", "-d", "-f", "calkit", remote_url]
        )
        subprocess.call(
            ["dvc", "remote", "modify", "calkit", "auth", "custom"]
        )
        repo.git.add(".dvc")
        repo.git.commit(["-m", "Create README and initialize DVC config"])
        repo.git.push(["origin", repo.active_branch.name])
    elif resp.status_code == 200:
        logger.info(f"Repo exists on GitHub as {owner_name}/{repo_name}")
        repo = resp.json()
        if owner_name != current_user.github_username:
            # This is either an org repo, or someone else's that we shouldn't
            # be able to import
            if repo["owner"]["type"] != "Organization":
                raise HTTPException(400, "Non-user repos must be from an org")
            # This org must exist in Calkit and the user must have access to it
            query = select(Org).where(Org.account.has(github_name=owner_name))
            org = session.exec(query).first()
            if org is None:
                logger.info(f"Org '{owner_name}' does not exist in DB")
                raise HTTPException(404, "This org does not exist in Calkit")
            owner_account_id = org.account.id
        else:
            owner_account_id = current_user.account.id
        project = Project.model_validate(
            project_in, update={"owner_account_id": owner_account_id}
        )
    logger.info("Adding to database")
    session.add(project)
    session.commit()
    session.refresh(project)
    # TODO: Create calkit.yaml file, README, DVC init
    return project


@router.get("/projects/{owner_name}/{project_name}")
def get_project_by_name(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> ProjectPublic:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    return project


class ProjectPatch(BaseModel):
    title: str | None = None
    description: str | None = None


@router.patch("/projects/{owner_name}/{project_name}")
def patch_project(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUser,
    req: ProjectPatch,
) -> ProjectPublic:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    if req.title is not None:
        project.title = req.title
    project.description = req.description
    session.commit()
    session.refresh(project)
    return ProjectPublic.model_validate(project)


@router.delete("/projects/{owner_name}/{project_name}")
def delete_project(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="owner",
    )
    session.delete(project)
    session.commit()
    return Message(message="success")


@router.delete("/projects/{project_id}")
def delete_project_by_id(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(404)
    # TODO: Check for collaborator access
    if project.owner != current_user:
        raise HTTPException(403)
    session.delete(project)
    session.commit()
    return Message(message="success")


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


def _get_object_fs() -> s3fs.S3FileSystem | gcsfs.GCSFileSystem:
    if settings.ENVIRONMENT == "local":
        return s3fs.S3FileSystem(
            endpoint_url="http://minio:9000",
            key="root",
            secret=os.getenv("MINIO_ROOT_PASSWORD"),
        )
    return gcsfs.GCSFileSystem()


def _get_data_prefix() -> str:
    if settings.ENVIRONMENT == "local":
        return "s3://data"
    else:
        return f"gcs://calkit-{settings.ENVIRONMENT}/data"


def _make_data_fpath(
    owner_name: str, project_name: str, idx: str, md5: str
) -> str:
    return f"{_get_data_prefix()}/{owner_name}/{project_name}/{idx}/{md5}"


def _get_object_url(
    fpath: str,
    fname: str = None,
    expires: int = 3600 * 24,
    fs: s3fs.S3FileSystem | gcsfs.GCSFileSystem | None = None,
    method: Literal["get", "put"] = "get",
    **kwargs,
) -> str:
    """Get a presigned URL for an object in object storage."""
    if fs is None:
        fs = _get_object_fs()
    if settings.ENVIRONMENT == "local":
        kws = {}
        if fname is not None:
            kws["ResponseContentDisposition"] = f"filename={fname}"
            if fname.endswith(".pdf"):
                kws["ResponseContentType"] = "application/pdf"
        kws["client_method"] = f"{method}_object"
    else:
        kws = {}
        if fname is not None:
            kws["response_disposition"] = f"filename={fname}"
            if fname.endswith(".pdf"):
                kws["response_type"] = "application/pdf"
        kws["method"] = method.upper()
    url: str = fs.sign(fpath, expiration=expires, **(kws | kwargs))
    if settings.ENVIRONMENT == "local":
        url = url.replace(
            "http://minio:9000", f"http://objects.{settings.DOMAIN}"
        )
    return url


def _remove_gcs_content_type(fpath):
    client = gcs.Client()
    bucket = client.bucket(f"calkit-{settings.ENVIRONMENT}")
    blob = bucket.blob(fpath.removeprefix(f"gcs://{bucket.name}/"))
    blob.content_type = None
    blob.patch()


@router.post("/projects/{owner_name}/{project_name}/dvc/files/md5/{idx}/{md5}")
async def post_project_dvc_file(
    *,
    owner_name: str,
    project_name: str,
    idx: str,
    md5: str,
    session: SessionDep,
    current_user: CurrentUserDvcScope,
    req: Request,
) -> Message:
    logger.info(
        f"Received request from {current_user.email} to post "
        f"DVC file MD5 {idx}{md5}"
    )
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    logger.info(f"{current_user.email} requesting to POST data")
    # TODO: Check if this user has write access to this project
    fs = _get_object_fs()
    # Create bucket if it doesn't exist -- only necessary with MinIO
    if settings.ENVIRONMENT == "local" and not fs.exists(_get_data_prefix()):
        fs.makedir(_get_data_prefix())
    # TODO: Create presigned PUT to upload the file so it doesn't need to pass
    # through this server
    fpath = _make_data_fpath(
        owner_name=owner_name, project_name=project_name, idx=idx, md5=md5
    )
    # Use a pending path during upload so we can rename after
    sig = hashlib.md5()
    pending_fpath = fpath + ".pending"
    with fs.open(pending_fpath, "wb") as f:
        # See https://stackoverflow.com/q/73322065/2284865
        async for chunk in req.stream():
            f.write(chunk)
            sig.update(chunk)
    # If using Google Cloud Storage, we need to remove the content type
    # metadata in order to set it for signed URLs
    if settings.ENVIRONMENT != "local":
        _remove_gcs_content_type(pending_fpath)
    digest = sig.hexdigest()
    logger.info(f"Computed MD5 from DVC post: {digest}")
    if md5.endswith(".dir"):
        digest += ".dir"
    if digest == idx + md5:
        logger.info("MD5 matches; removing pending suffix")
        fs.mv(pending_fpath, fpath)
    else:
        logger.warning("MD5 does not match")
        raise HTTPException(400, "MD5 does not match")
    return Message(message="Success")


@router.get("/projects/{owner_name}/{project_name}/dvc/files/md5/{idx}/{md5}")
def get_project_dvc_file(
    *,
    owner_name: str,
    project_name: str,
    idx: str,
    md5: str,
    session: SessionDep,
    current_user: CurrentUserDvcScope,
) -> StreamingResponse:
    logger.info(f"{current_user.email} requesting to GET data")
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    # If file doesn't exist, return 404
    fs = _get_object_fs()
    fpath = _make_data_fpath(
        owner_name=owner_name, project_name=project_name, idx=idx, md5=md5
    )
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
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
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
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
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


class ItemLock(BaseModel):
    created: datetime
    user_id: uuid.UUID
    user_email: str
    user_github_username: str


class _ContentsItemBase(BaseModel):
    name: str
    path: str
    type: str | None
    size: int | None
    in_repo: bool
    content: str | None = None
    url: str | None = None
    calkit_object: dict | None = None
    lock: ItemLock | None = None


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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
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
    categories_no_path = ["questions"]
    ck_objects = {}
    for category, itemlist in ck_info.items():
        if category in categories_no_path:
            continue
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
            # Handle files inside references objects
            if category == "references":
                ref_item_files = item.get("files", [])
                for rif in ref_item_files:
                    if "path" in rif:
                        ck_objects[rif["path"]] = dict(
                            kind="references item file",
                            references_path=item["path"],
                            path=rif["path"],
                            key=rif.get("key"),
                        )
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
    file_locks_by_path = {
        lock.path: ItemLock.model_validate(lock.model_dump())
        for lock in project.file_locks
    }
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
                lock=file_locks_by_path.get(p),
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
                        lock=file_locks_by_path.get(ck_path),
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
    # We're looking for a file
    # Check if it exists in the repo,
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
                lock=file_locks_by_path.get(path),
            )
        )
    # The file isn't in the repo, but maybe it's in the Calkit objects
    elif path in ck_objects:
        dvc_out = ck_outs.get(path)
        if dvc_out is None:
            dvc_out = {}
        size = dvc_out.get("size")
        md5 = dvc_out.get("md5", "")
        dvc_fpath = dvc_out.get("path")
        dvc_type = "dir" if md5.endswith(".dir") else "file"
        content = None
        url = None
        # Create presigned url
        if md5:
            fs = _get_object_fs()
            fp = _make_data_fpath(
                owner_name=owner_name,
                project_name=project_name,
                idx=md5[:2],
                md5=md5[2:],
            )
            url = _get_object_url(fp, fname=os.path.basename(dvc_fpath), fs=fs)
            # Get content is the size is small enough
            if (
                size is not None
                and size <= RETURN_CONTENT_SIZE_LIMIT
                and fs.exists(fp)
                and not path.endswith(".h5")
                and not path.endswith(".parquet")
            ):
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
                lock=file_locks_by_path.get(path),
            )
        )
    else:
        # Do we have a DVC file for this path?
        dvc_fpath = os.path.join(repo_dir, path + ".dvc")
        if os.path.isfile(dvc_fpath):
            # Open the DVC file so we can get its MD5 hash
            with open(dvc_fpath) as f:
                dvc_info = yaml.load(f)
            dvc_out = dvc_info["outs"][0]
            md5 = dvc_out["md5"]
            fs = _get_object_fs()
            fp = _make_data_fpath(
                owner_name=owner_name,
                project_name=project_name,
                idx=md5[:2],
                md5=md5[2:],
            )
            url = _get_object_url(fp, fname=os.path.basename(path), fs=fs)
            size = dvc_out["size"]
            dvc_type = "dir" if md5.endswith(".dir") else "file"
            return ContentsItem.model_validate(
                dict(
                    path=path,
                    name=os.path.basename(path),
                    size=size,
                    type=dvc_type,
                    in_repo=False,
                    url=url,
                    lock=file_locks_by_path.get(path),
                )
            )
        raise HTTPException(404)


def _valid_file_size(content_length: int = Header(lt=1_000_000)):
    """Check content length header.

    From https://github.com/fastapi/fastapi/issues/362#issuecomment-584104025
    """
    return content_length


@router.put(
    "/projects/{owner_name}/{project_name}/contents/{path:path}",
    dependencies=[Depends(_valid_file_size)],
)
def put_project_contents(
    owner_name: str,
    project_name: str,
    path: str,
    file: Annotated[UploadFile, File()],
    session: SessionDep,
    current_user: CurrentUser,
) -> ContentsItem:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="write",
    )
    locked_paths = [lock.path for lock in project.file_locks]
    if path in locked_paths:
        raise HTTPException(400, "Path is currently locked")
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    dirname = os.path.dirname(path)
    os.makedirs(os.path.join(repo.working_dir, dirname), exist_ok=True)
    with open(os.path.join(repo.working_dir, path), "wb") as f:
        f.write(file.file.read())
    repo.git.add(path)
    if repo.git.diff(["--staged", path]):
        repo.git.commit(["-m", f"Upload {path} from web"])
        repo.git.push(["origin", repo.active_branch.name])
    else:
        raise HTTPException(
            400,
            (
                "File is either not different or ignored by Git "
                "and/or tracked in DVC"
            ),
        )
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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="write",
    )
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
        if not isinstance(objlist, list):
            continue
        for obj in objlist:
            # TODO: We need a better way to say which categories have objects
            # with paths
            if not isinstance(obj, dict):
                continue
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


def _sync_questions_with_db(
    ck_info: dict, project: Project, session: Session
) -> Project:
    questions_ck = list(ck_info.get("questions", []))
    questions = deepcopy(questions_ck)
    logger.info(f"Found {len(questions)} questions in Calkit info")
    # Put these in the database idempotently
    existing_questions = project.questions
    logger.info(f"Found {len(existing_questions)} existing questions in DB")
    for n, (new, existing) in enumerate(zip(questions_ck, existing_questions)):
        logger.info(f"Updating existing question number {n + 1}")
        existing.question = questions.pop(0)  # Just a list of strings
        existing.number = n + 1  # Should already be done, but just in case
    start_number = len(existing_questions) + 1
    logger.info(f"Adding {len(questions)} new questions to DB")
    for n, new in enumerate(questions):
        number = start_number + n
        logger.info(f"Appending new question with number: {number}")
        project.questions.append(Question(number=number, question=new))
    # Delete extra questions in DB
    while len(project.questions) > len(questions_ck):
        q = project.questions.pop(-1)
        logger.info(f"Deleting question number {q.number}")
        session.delete(q)
    session.commit()
    session.refresh(project)
    return project


@router.get("/projects/{owner_name}/{project_name}/questions")
def get_project_questions(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Question]:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    ck_info = get_ck_info(
        project=project, user=current_user, session=session, ttl=300
    )
    project = _sync_questions_with_db(
        ck_info=ck_info, project=project, session=session
    )
    # TODO: Maybe questions don't belong in the Calkit file?
    return project.questions


class QuestionPost(BaseModel):
    question: str


@router.post("/projects/{owner_name}/{project_name}/questions")
def post_project_question(
    owner_name: str,
    project_name: str,
    req: QuestionPost,
    current_user: CurrentUser,
    session: SessionDep,
) -> Question:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="write",
    )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    ck_info = get_ck_info_from_repo(repo)
    ck_questions = ck_info.get("questions", [])
    ck_questions.append(req.question)
    ck_info["questions"] = ck_questions
    with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    repo.git.commit(["-m", "Add question"])
    repo.git.push(["origin", repo.active_branch.name])
    project = _sync_questions_with_db(
        ck_info=ck_info, project=project, session=session
    )
    return project.questions[-1]


@router.get("/projects/{owner_name}/{project_name}/figures")
def get_project_figures(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Figure]:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
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
        fig["url"] = item.url
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
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
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
        fs = _get_object_fs()
        fpath = _make_data_fpath(
            owner_name=owner_name,
            project_name=project_name,
            idx=md5[:2],
            md5=md5[2:],
        )
        with fs.open(fpath, "wb") as f:
            f.write(file_data)
        if settings.ENVIRONMENT != "local":
            _remove_gcs_content_type(fpath)
        url = _get_object_url(fpath=fpath, fname=os.path.basename(path))
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
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
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
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
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


def _sync_datasets_with_db(
    ck_info: dict, project: Project, session: Session
) -> Project:
    datasets_ck = list(ck_info.get("datasets", []))
    datasets = deepcopy(datasets_ck)
    # Convert imported_from from dict to str for saving in the database
    for ds in datasets:
        if "imported_from" in ds:
            if isinstance(ds["imported_from"], dict):
                prj = ds["imported_from"].get("project")
                path = ds["imported_from"].get("path")
                if prj is None:
                    ds["imported_from"] = None
                else:
                    imported_from = prj
                    if path is not None:
                        imported_from += "/" + path
                    ds["imported_from"] = imported_from
    logger.info(f"Found {len(datasets)} datasets in Calkit info")
    # Put these in the database idempotently
    existing_datasets = project.datasets
    logger.info(f"Found {len(existing_datasets)} existing datasets in DB")
    # First update any existing datasets, identified by path
    existing_keyed_by_path = {ds.path: ds for ds in existing_datasets}
    update_keyed_by_path = {ds["path"]: ds for ds in datasets}
    for path, ds in existing_keyed_by_path.items():
        if path in update_keyed_by_path:
            logger.info(f"Updating dataset with path: {path}")
            ds.sqlmodel_update(update_keyed_by_path[path])
        else:
            logger.info(f"Deleting dataset with path: {path}")
            session.delete(ds)
    # Now add any new ones missing
    for path, ds in update_keyed_by_path.items():
        if path not in existing_keyed_by_path:
            logger.info(f"Adding new dataset at path: {path}")
            project.datasets.append(
                Dataset.model_validate(ds, update=dict(project_id=project.id))
            )
    session.commit()
    session.refresh(project)
    return project


@router.get("/projects/{owner_name}/{project_name}/datasets")
def get_project_datasets(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Dataset]:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    # Read the datasets file from the repo
    ck_info = get_ck_info(
        project=project, user=current_user, session=session, ttl=300
    )
    project = _sync_datasets_with_db(
        ck_info=ck_info, project=project, session=session
    )
    return project.datasets


@router.get("/projects/{owner_name}/{project_name}/datasets/{path:path}")
def get_project_dataset(
    path: str,
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> DatasetDVCImport:
    logger.info(f"Received request to get dataset with path: {path}")
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    # Read the datasets file from the repo
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=300
    )
    repo_dir = repo.working_dir
    ck_info = get_ck_info_from_repo(repo)
    datasets = ck_info.get("datasets", [])
    dvc_out = dict(
        remote=f"calkit:{owner_name}/{project_name}",
        push=False,
    )
    for ds in datasets:
        if "path" in ds and ds["path"] == path:
            # Create the DVC import object
            # We need to know the MD5 hash
            stage_name = ds.get("stage")
            if stage_name is None:
                dvc_fp = os.path.join(repo_dir, path + ".dvc")
                if os.path.isfile(dvc_fp):
                    with open(dvc_fp) as f:
                        dvo = yaml.safe_load(f)["outs"][0]
                    dvc_out |= dvo
                    ds["dvc_import"] = dict(outs=[dvc_out])
                    return DatasetDVCImport.model_validate(ds)
                else:
                    # No stage and no .dvc file -- error
                    logger.info("No stage nor .dvc file found")
                    raise HTTPException(404)
            else:
                pipeline_fpath = os.path.join(repo_dir, "dvc.yaml")
                if not os.path.isfile(pipeline_fpath):
                    logger.info("No dvc.yaml file")
                    raise HTTPException(400, "dvc.yaml file missing")
                with open(pipeline_fpath) as f:
                    pipeline = yaml.safe_load(f)
                dvc_lock_fpath = os.path.join(repo_dir, "dvc.lock")
                if not os.path.isfile(dvc_lock_fpath):
                    logger.info("No dvc.lock file")
                    raise HTTPException(400, "dvc.lock file missing")
                with open(dvc_lock_fpath) as f:
                    dvc_lock = yaml.safe_load(f)
                out = output_from_pipeline(
                    path=path,
                    stage_name=stage_name,
                    pipeline=pipeline,
                    lock=dvc_lock,
                )
                if out is None:
                    raise HTTPException(400, "Cannot find DVC object")
                dvc_out |= out
                ds["dvc_import"] = dict(outs=[dvc_out])
                return DatasetDVCImport.model_validate(ds)
    raise HTTPException(404)


class LabelDatasetPost(BaseModel):
    imported_from: str | None = None
    path: str
    title: str | None = None
    tabular: bool | None = None
    stage: str | None = None
    description: str | None = None


@router.post("/projects/{owner_name}/{project_name}/datasets/label")
def post_project_dataset_label(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    req: LabelDatasetPost,
) -> Dataset:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    if not req.imported_from:
        if not req.title or not req.description:
            raise HTTPException(
                400, "Non-imported datasets must have titles and descriptions"
            )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    ck_info = get_ck_info_from_repo(repo)
    datasets = ck_info.get("datasets", [])
    ds_paths = [ds.get("path") for ds in datasets]
    if req.path in ds_paths:
        raise HTTPException(400, "Dataset already exists")
    local_path = os.path.join(repo.working_dir, req.path)
    if not req.imported_from and not (
        os.path.isfile(local_path) or os.path.isfile(local_path + ".dvc")
    ):
        raise HTTPException(400, "Path does not exist in the repo")
    ds = dict(path=req.path)
    for k, v in req.model_dump().items():
        if k == "path":
            continue
        if v is not None:
            ds[k] = v
    datasets.append(ds)
    ck_info["datasets"] = datasets
    with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    # Make a commit
    repo.git.commit(["-m", f"Add dataset {req.path}"])
    repo.git.push(["origin", repo.active_branch.name])
    # TODO: Put datasets into database
    return Dataset.model_validate(
        ds | dict(project_id=project.id, id=uuid.uuid4())
    )


def _valid_dataset_size(content_length: int = Header(lt=50_000_000)):
    """Check content length header.

    From https://github.com/fastapi/fastapi/issues/362#issuecomment-584104025
    """
    return content_length


@router.post(
    "/projects/{owner_name}/{project_name}/datasets/upload",
    dependencies=[Depends(_valid_dataset_size)],
)
def post_project_dataset_upload(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    path: Annotated[str, Form()],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
) -> Dataset:
    logger.info(
        f"Received dataset file {path} with content type: "
        f"{file.content_type}"
    )
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    # Handle projects that aren't yet Calkit projects
    ck_info = get_ck_info_from_repo(repo)
    datasets = ck_info.get("datasets", [])
    # Make sure a dataset with this path doesn't already exist
    dspaths = [ds["path"] for ds in datasets]
    if path in dspaths:
        raise HTTPException(400, "A dataset already exists at this path")
    # Add the file to the repo(s)
    # Save the file to the desired path
    os.makedirs(
        os.path.join(repo.working_dir, os.path.dirname(path)),
        exist_ok=True,
    )
    file_data = file.file.read()
    full_ds_path = os.path.join(repo.working_dir, path)
    with open(full_ds_path, "wb") as f:
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
    # Update figures
    datasets.append(dict(path=path, title=title, description=description))
    ck_info["datasets"] = datasets
    with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    # Make a commit
    repo.git.commit(["-m", f"Add dataset {path}"])
    # Push to GitHub, and optionally DVC remote if we used it
    repo.git.push(["origin", repo.active_branch.name])
    # If using the DVC remote, we can just put it in the expected location
    # since we'll have the md5 hash in the dvc file
    with open(os.path.join(repo.working_dir, path + ".dvc")) as f:
        dvc_yaml = yaml.safe_load(f)
    md5 = dvc_yaml["outs"][0]["md5"]
    fs = _get_object_fs()
    fpath = _make_data_fpath(
        owner_name=owner_name,
        project_name=project_name,
        idx=md5[:2],
        md5=md5[2:],
    )
    with fs.open(fpath, "wb") as f:
        f.write(file_data)
    if settings.ENVIRONMENT != "local":
        _remove_gcs_content_type(fpath)
    url = _get_object_url(fpath=fpath, fname=os.path.basename(path))
    # Finally, remove the dataset from the cached repo
    os.remove(full_ds_path)
    # TODO: Put this dataset into the database
    return Dataset(
        project_id=project.id,
        id=uuid.uuid4(),  # TODO: Should be in DB
        path=path,
        title=title,
        description=description,
        content=None,
        url=url,
    )


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
    url: str | None = None


@router.get("/projects/{owner_name}/{project_name}/publications")
def get_project_publications(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Publication]:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
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


@router.post("/projects/{owner_name}/{project_name}/publications")
def post_project_publication(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    path: Annotated[str, Form()],
    kind: Annotated[
        Literal[
            "journal-article",
            "conference-paper",
            "presentation",
            "poster",
            "report",
            "book",
        ],
        Form(),
    ],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()],
    stage: Optional[Annotated[str, Form()]] = Form(None),
    file: Optional[Annotated[UploadFile, File()]] = Form(None),
) -> Publication:
    if file is not None:
        logger.info(
            f"Received publication file {path} with content type: "
            f"{file.content_type}"
        )
    else:
        logger.info(f"Received request to create publication from {path}")
    if file is not None and stage is not None:
        raise HTTPException(
            400, "DVC outputs should be uploaded with `dvc push`"
        )
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    # Handle projects that aren't yet Calkit projects
    ck_info = get_ck_info_from_repo(repo)
    publications = ck_info.get("publications", [])
    # Make sure a publication with this path doesn't already exist
    pubpaths = [pub["path"] for pub in publications]
    if path in pubpaths:
        raise HTTPException(400, "A publication already exists at this path")
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
    publications.append(
        dict(
            path=path,
            type=kind,
            title=title,
            description=description,
            stage=stage,
        )
    )
    ck_info["publications"] = publications
    with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    # Make a commit
    repo.git.commit(["-m", f"Add publication {path} ({kind})"])
    # Push to GitHub, and optionally DVC remote if we used it
    repo.git.push(["origin", repo.active_branch.name])
    url = None
    if file is not None:
        # If using the DVC remote, we can just put it in the expected location
        # since we'll have the md5 hash in the dvc file
        with open(os.path.join(repo.working_dir, path + ".dvc")) as f:
            dvc_yaml = yaml.safe_load(f)
        md5 = dvc_yaml["outs"][0]["md5"]
        fs = _get_object_fs()
        fpath = _make_data_fpath(
            owner_name=owner_name,
            project_name=project_name,
            idx=md5[:2],
            md5=md5[2:],
        )
        with fs.open(fpath, "wb") as f:
            f.write(file_data)
        if settings.ENVIRONMENT != "local":
            _remove_gcs_content_type(fpath)
        url = _get_object_url(fpath=fpath, fname=os.path.basename(path))
        # Finally, remove the figure from the cached repo
        os.remove(full_fig_path)
    return Publication(
        path=path,
        title=title,
        description=description,
        stage=stage,
        content=None,
        url=url,
    )


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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    # TODO: GitHub requires higher permissions to get collaborators
    # Maybe for read-only people we should return contributors?
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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="admin",
    )
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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="admin",
    )
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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="write",
    )
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
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="admin",
    )
    # TODO: A user who created the issue can edit?
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


class ImportInfo(BaseModel):
    project_owner: str
    project_name: str
    git_rev: str | None = None
    path: str


class ReferenceEntry(BaseModel):
    type: str
    key: str
    file_path: str | None = None
    url: str | None = None
    attrs: dict


class ReferenceFile(BaseModel):
    path: str
    key: str


class References(BaseModel):
    path: str
    files: list[ReferenceFile] | None = None
    entries: list[ReferenceEntry] | None = None
    imported_from: ImportInfo | None = None
    raw_text: str | None = None


@router.get("/projects/{owner_name}/{project_name}/references")
def get_project_references(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[References]:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=300
    )
    ck_info = get_ck_info_from_repo(repo)
    ref_collections = ck_info.get("references", [])
    resp = []
    for ref_collection in ref_collections:
        # Read entries
        path = ref_collection["path"]
        if os.path.isfile(os.path.join(repo.working_dir, path)):
            with open(os.path.join(repo.working_dir, path)) as f:
                raw_text = f.read()
            ref_collection["raw_text"] = raw_text
            refs = bibtexparser.loads(raw_text)
            entries = refs.entries
            final_entries = []
            file_paths = {
                f["key"]: f["path"] for f in ref_collection.get("files", [])
            }
            for entry in entries:
                key = entry.pop("ID")
                reftype = entry.pop("ENTRYTYPE")
                file_path = file_paths.get(key)
                url = None
                # If a file path is defined, read it and get the presigned URL
                if file_path is not None:
                    logger.info(f"Looking for reference file: {file_path}")
                    try:
                        contents_item = get_project_contents(
                            owner_name=owner_name,
                            project_name=project_name,
                            session=session,
                            current_user=current_user,
                            path=file_path,
                        )
                        url = contents_item.url
                    except HTTPException as e:
                        logger.warning(
                            f"Could not find contents for {key}: {e}"
                        )
                final_entries.append(
                    ReferenceEntry.model_validate(
                        dict(
                            key=key,
                            type=reftype,
                            attrs=entry,
                            file_path=file_path,
                            url=url,
                        )
                    )
                )
            ref_collection["entries"] = final_entries
        resp.append(References.model_validate(ref_collection))
    return resp


class Environment(BaseModel):
    kind: Literal["docker", "conda"]
    path: str
    file_content: str | None = None


class Software(BaseModel):
    environments: list[Environment]
    # TODO: Add scripts, packages, apps?


@router.get("/projects/{owner_name}/{project_name}/software")
def get_project_software(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> Software:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=300
    )
    ck_info = get_ck_info_from_repo(repo)
    envs = ck_info.get("environments", [])
    resp = []
    for env in envs:
        fpath = os.path.join(repo.working_dir, env["path"])
        with open(fpath) as f:
            env["file_content"] = f.read()
        resp.append(Environment.model_validate(env))
    return Software(environments=resp)


@router.get("/projects/{owner_name}/{project_name}/file-locks")
def get_project_file_locks(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[FileLock]:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    return project.file_locks


class FileLockPost(BaseModel):
    path: str


@router.post("/projects/{owner_name}/{project_name}/file-locks")
def post_project_file_lock(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    req: FileLockPost,
) -> FileLock:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="write",
    )
    existing = project.file_locks
    for lock in existing:
        if lock.path == req.path:
            raise HTTPException(400, "File is already locked")
    lock = FileLock(
        project_id=project.id, user_id=current_user.id, path=req.path
    )
    session.add(lock)
    session.commit()
    session.refresh(lock)
    return lock


@router.delete("/projects/{owner_name}/{project_name}/file-locks")
def delete_project_file_lock(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    req: FileLockPost,
) -> Message:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="write",
    )
    existing = project.file_locks
    for lock in existing:
        if lock.path == req.path:
            if lock.user != current_user:
                raise HTTPException(403, "Cannot delete someone else's lock")
            session.delete(lock)
            session.commit()
            return Message(message="success")
    raise HTTPException(404, "Lock not found")


class Notebook(BaseModel):
    path: str
    title: str
    description: str | None = None
    stage: str | None = None
    output_format: Literal["html", "notebook"] | None = None
    url: str | None = None


@router.get("/projects/{owner_name}/{project_name}/notebooks")
def get_project_notebooks(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[Notebook]:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    ck_info = get_ck_info(
        project=project, user=current_user, session=session, ttl=300
    )
    notebooks = ck_info.get("notebooks", [])
    if not notebooks:
        return notebooks
    # Get the figure content and base64 encode it
    for notebook in notebooks:
        item = get_project_contents(
            owner_name=owner_name,
            project_name=project_name,
            session=session,
            current_user=current_user,
            path=notebook["path"],
        )
        notebook["url"] = item.url
        # Figure out the output format from the URL content disposition
        if item.url is not None:
            params = params_from_url(item.url)
            rcd = params.get("response-content-disposition")
            if rcd is not None:
                if rcd[0].endswith(".ipynb"):
                    notebook["output_format"] = "notebook"
                elif rcd[0].endswith(".html"):
                    notebook["output_format"] = "html"
    return [Notebook.model_validate(nb) for nb in notebooks]
