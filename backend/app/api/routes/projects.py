"""Routes for projects."""

import functools
import hashlib
import io
import logging
import os
import shutil
import subprocess
import uuid
from copy import deepcopy
from datetime import datetime
from fnmatch import fnmatch
from io import StringIO
from pathlib import Path
from typing import Annotated, Literal, Optional

import bibtexparser
import calkit
import requests
import sqlalchemy
import yaml
from calkit.check import ReproCheck, check_reproducibility
from calkit.models import ProjectStatus
from calkit.notebooks import get_executed_notebook_path
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError
from sqlmodel import Session, and_, func, not_, or_, select
from TexSoup import TexSoup

import app.projects
from app import mixpanel, users
from app.api.deps import (
    CurrentUser,
    CurrentUserDvcScope,
    CurrentUserOptional,
    SessionDep,
)
from app.api.routes.orgs import OrgPost, post_org
from app.config import settings
from app.core import (
    CATEGORIES_PLURAL_TO_SINGULAR,
    CATEGORIES_SINGULAR_TO_PLURAL,
    params_from_url,
    ryaml,
)
from app.dvc import (
    expand_dvc_lock_outs,
    make_mermaid_diagram,
    output_from_pipeline,
)
from app.git import (
    get_ck_info,
    get_ck_info_from_repo,
    get_dvc_pipeline_from_repo,
    get_overleaf_repo,
    get_repo,
)
from app.models import (
    Account,
    ContentsItem,
    Dataset,
    DatasetForImport,
    Figure,
    FigureComment,
    FigureCommentPost,
    FileLock,
    Message,
    Notebook,
    Org,
    OrgSubscription,
    Pipeline,
    Project,
    ProjectCreate,
    ProjectPublic,
    ProjectsPublic,
    Publication,
    Question,
    User,
    UserOrgMembership,
    UserProjectAccess,
)
from app.models.projects import (
    Showcase,
    ShowcaseFigure,
    ShowcaseFigureInput,
    ShowcaseInput,
    ShowcaseMarkdown,
    ShowcaseMarkdownFileInput,
    ShowcaseNotebook,
    ShowcaseNotebookInput,
    ShowcasePublication,
    ShowcasePublicationInput,
    ShowcaseText,
    ShowcaseYaml,
    ShowcaseYamlFileInput,
)
from app.storage import (
    get_data_prefix,
    get_object_fs,
    get_object_url,
    get_storage_usage,
    make_data_fpath,
    remove_gcs_content_type,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

DEFAULT_REPO_TTL = 60  # Seconds


@router.get("/projects")
def get_projects(
    session: SessionDep,
    current_user: CurrentUserOptional,
    limit: int = 100,
    offset: int = 0,
    search_for: str | None = None,
    owner_name: str | None = None,
) -> ProjectsPublic:
    if current_user is None:
        where_clause = Project.is_public
    else:
        where_clause = or_(
            Project.is_public,
            Project.owner_account_id == current_user.account.id,
            and_(
                UserProjectAccess.user_id == current_user.id,
                UserProjectAccess.access.is_not(None),
            ),
            Project.owner_account.has(
                and_(
                    Account.org_id.is_not(None),
                    select(UserOrgMembership)
                    .where(
                        UserOrgMembership.user_id == current_user.id,
                        UserOrgMembership.org_id == Account.org_id,
                    )
                    .exists(),
                )
            ),
        )
    if owner_name is not None:
        where_clause = and_(
            where_clause,
            Project.owner_account.has(Account.name == owner_name),
        )
    if search_for is not None:
        search_for = f"%{search_for}%"
        where_clause = and_(
            where_clause,
            or_(
                Project.name.ilike(search_for),
                Project.title.ilike(search_for),
                Project.description.ilike(search_for),
                Project.git_repo_url.ilike(search_for),
            ),
        )
    count_query = (
        select(func.count())
        .select_from(Project)
        .distinct()
        .join(Project.user_access_records, isouter=True)
        .where(where_clause)
    )
    count = session.exec(count_query).one()
    select_query = (
        select(Project)
        .distinct()
        .join(Project.user_access_records, isouter=True)
        .where(where_clause)
        .order_by(sqlalchemy.desc(Project.created))
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
    search_for: str | None = None,
) -> ProjectsPublic:
    where_clause = or_(
        Project.owner_account_id == current_user.account.id,
        Project.owner_account.has(
            and_(
                Account.org_id.is_not(None),
                select(UserOrgMembership)
                .where(
                    UserOrgMembership.user_id == current_user.id,
                    UserOrgMembership.org_id == Account.org_id,
                )
                .exists(),
            )
        ),
    )
    if search_for is not None:
        search_for = f"%{search_for}%"
        where_clause = and_(
            where_clause,
            or_(
                Project.name.ilike(search_for),
                Project.title.ilike(search_for),
                Project.description.ilike(search_for),
                Project.git_repo_url.ilike(search_for),
            ),
        )
    count_statement = (
        select(func.count()).select_from(Project).where(where_clause)
    )
    count = session.exec(count_statement).one()
    statement = (
        select(Project)
        .where(where_clause)
        .order_by(sqlalchemy.desc(Project.created))
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
    if project_in.git_repo_url is None:
        project_in.git_repo_url = (
            f"https://github.com/{current_user.account.name}/{project_in.name}"
        )
    # First check if template even exists, if specified
    if project_in.template is not None:
        template_owner_name, template_project_name = project_in.template.split(
            "/"
        )
        template_project = app.projects.get_project(
            session=session,
            owner_name=template_owner_name,
            project_name=template_project_name,
            current_user=current_user,
            min_access_level="read",
        )
    # Detect owner and repo name from Git repo URL
    # TODO: This should be generalized to not depend on GitHub?
    owner_name, repo_name = project_in.git_repo_url.split("/")[-2:]
    # Check if this user has exceeded their private projects limit if this one
    # is private
    if not project_in.is_public:
        logger.info(f"Checking private project count for {owner_name}")
        if current_user.account.name == owner_name:
            # Count private projects for user
            account_id = current_user.account.id
            subscription = current_user.subscription
        else:
            # Count private projects for an org
            # First check if this org exists in Calkit
            query = select(Org).where(Org.account.has(github_name=owner_name))
            org = session.exec(query).first()
            if org is None:
                logger.info(f"Org '{owner_name}' does not exist in DB")
                # Try to create the org
                post_org(
                    req=OrgPost(github_name=owner_name),
                    session=session,
                    current_user=current_user,
                )
                org = session.exec(query).first()
            assert isinstance(org, Org)
            account_id = org.account.id
            subscription = org.subscription
            if subscription is None:
                logger.info(f"Org '{owner_name}' does not have a subscription")
                # Give the org a free subscription
                org.subscription = OrgSubscription(
                    plan_id=0,
                    n_users=1,
                    price=0.0,
                    period_months=1,
                    subscriber_user_id=current_user.id,
                    org_id=org.id,
                )
                session.add(org.subscription)
                session.commit()
                session.refresh(org.subscription)
                subscription = org.subscription
        count_query = (
            select(func.count())
            .select_from(Project)
            .where(
                and_(
                    not_(Project.is_public),
                    Project.owner_account_id == account_id,
                )
            )
        )
        count = session.exec(count_query).one()
        limit = subscription.private_projects_limit  # type: ignore
        logger.info(f"{owner_name} has {count}/{limit} private projects")
        if limit is not None and count >= limit:
            raise HTTPException(400, "Private projects limit exceeded")
    # Check if this user already owns this repo on GitHub
    token = users.get_github_token(session=session, user=current_user)
    headers = {"Authorization": f"Bearer {token}"}
    repo_html_url = f"https://github.com/{owner_name}/{repo_name}"
    repo_api_url = f"https://api.github.com/repos/{owner_name}/{repo_name}"
    resp = requests.get(repo_api_url, headers=headers)
    # Check if the repo is already associated with a project
    query = select(Project).where(Project.git_repo_url == repo_html_url)
    project = session.exec(query).first()
    git_repo_url_is_occupied = project is not None
    if git_repo_url_is_occupied:
        logger.info("Git repo is already occupied by another project")
        raise HTTPException(409, "Repos can only be associated with 1 project")
    elif resp.status_code == 404:
        if owner_name != current_user.github_username:
            raise HTTPException(403, "Can only create new repos for yourself")
        # If not owned, create it
        logger.info(f"Creating GitHub repo for {owner_name}: {repo_name}")
        body = {
            "name": repo_name,
            "description": project_in.description,
            "homepage": f"https://calkit.io/{owner_name}/{project_in.name}",
            "private": not project_in.is_public,
            "has_discussions": True,
            "has_issues": True,
            "has_wiki": True,
        }
        # If creating from a template repo, we want it to be empty
        if project_in.template is None:
            body["gitignore_template"] = "Python"
        resp = requests.post(
            "https://api.github.com/user/repos",
            json=body,
            headers=headers,
        )
        if not resp.status_code == 201:
            not_installed_message = (
                "Calkit GitHub App not enabled for this account or repo."
            )
            logger.warning(f"Failed to create: {resp.json()}")
            try:
                message = resp.json()["errors"][0]["message"].capitalize()
                if message.lower().startswith("name already exists"):
                    message = not_installed_message
            except Exception:
                try:
                    message = resp.json()["message"]
                    if message.lower().startswith("resource not accessible"):
                        message = not_installed_message
                except Exception:
                    message = "Failed to create GitHub repo"
            raise HTTPException(resp.status_code, message)
        resp_json = resp.json()
        logger.info(f"Created GitHub repo with URL: {resp_json['html_url']}")
        add_info = {"owner_account_id": current_user.account.id}
        if project_in.template is not None:
            add_info["parent_project_id"] = template_project.id
        project = Project.model_validate(project_in, update=add_info)
        logger.info("Adding project to database")
        session.add(project)
        session.commit()
        session.refresh(project)
        # Clone the repo and setup the Calkit DVC remote
        repo = get_repo(
            project=project,
            session=session,
            user=current_user,
            fresh=True,
        )
        # If we have a template, set as upstream and pull from it
        if project_in.template is not None:
            template_git_repo_url = template_project.git_repo_url
            repo.git.remote(["add", "upstream", template_git_repo_url])
            repo.git.pull(["upstream", repo.active_branch.name])
            # Remove upstream remote so we don't have any confusion later
            repo.git.remote(["remove", "upstream"])
            template_repo = get_repo(
                project=template_project,
                session=session,
                user=current_user,
                fresh=True,
            )
            # Delete files that don't belong in a template
            delete_files = ["dvc.lock"]
            for f in delete_files:
                if os.path.isfile(os.path.join(repo.working_dir, f)):
                    repo.git.rm(f, "-f")
        # Add a calkit.yaml file
        # First existing info, which is empty unless we're using a template
        ck_info = calkit.load_calkit_info(wdir=repo.working_dir)  # type: ignore
        _ = ck_info.pop("questions", None)
        ck_info |= {
            "owner": owner_name,
            "name": project.name,
            "title": project.title,
            "description": project.description,
            "git_repo_url": project.git_repo_url,
        }
        if project_in.template is not None:
            ck_info["derived_from"] = dict(
                project=project_in.template,
                git_repo_url=template_git_repo_url,
                git_rev=template_repo.git.rev_parse("HEAD"),
            )
        with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
            ryaml.dump(ck_info, f)
        repo.git.add("calkit.yaml")
        if project_in.template is None:
            # Create devcontainer spec
            dc_url = (
                "https://raw.githubusercontent.com/calkit/devcontainer/"
                "refs/heads/main/devcontainer.json"
            )
            dc_resp = requests.get(dc_url)
            dc_dir = os.path.join(repo.working_dir, ".devcontainer")
            os.makedirs(dc_dir, exist_ok=True)
            dc_fpath = os.path.join(dc_dir, "devcontainer.json")
            with open(dc_fpath, "w") as f:
                f.write(dc_resp.text)
            repo.git.add(".devcontainer")
        # Create the README
        logger.info("Creating README.md")
        with open(os.path.join(repo.working_dir, "README.md"), "w") as f:
            txt = f"# {project_in.title}\n\n"
            if project_in.description is not None:
                txt += f"\n{project_in.description}\n"
            f.write(txt)
        repo.git.add("README.md")
        # Setup the DVC remote
        logger.info("Running DVC init")
        subprocess.call(["dvc", "init", "--force", "-q"], cwd=repo.working_dir)
        logger.info("Enabling DVC autostage")
        subprocess.call(
            ["dvc", "config", "core.autostage", "true"], cwd=repo.working_dir
        )
        logger.info("Setting up default DVC remote")
        base_url = "https://api.calkit.io"
        remote_url = f"{base_url}/projects/{owner_name}/{project.name}/dvc"
        subprocess.call(
            ["dvc", "remote", "add", "-d", "-f", "calkit", remote_url],
            cwd=repo.working_dir,
        )
        subprocess.call(
            ["dvc", "remote", "modify", "calkit", "auth", "custom"],
            cwd=repo.working_dir,
        )
        repo.git.add(".dvc")
        if project_in.template is not None:
            commit_msg = f"Create new project from {project_in.template}"
        else:
            commit_msg = "Create README.md, DVC config, and calkit.yaml"
        repo.git.commit(["-m", commit_msg])
        repo.git.push(["origin", repo.active_branch.name])
    elif resp.status_code == 200:
        logger.info(f"Repo exists on GitHub as {owner_name}/{repo_name}")
        if project_in.template is not None:
            raise HTTPException(
                400, "Templates can only be used with new repos"
            )
        repo = resp.json()
        if owner_name != current_user.github_username:
            # This is either an org repo, or someone else's that we shouldn't
            # be able to import
            if repo["owner"]["type"] != "Organization":
                raise HTTPException(400, "Non-user repos must be from an org")
            # This org must exist in Calkit and the user must have access to it
            # First check if this org exists in Calkit and try to create it
            # if it doesn't
            query = select(Org).where(Org.account.has(github_name=owner_name))
            org = session.exec(query).first()
            if org is None:
                logger.info(f"Org '{owner_name}' does not exist in DB")
                # Try to create the org
                post_org(
                    req=OrgPost(github_name=owner_name),
                    session=session,
                    current_user=current_user,
                )
                org = session.exec(query).first()
            assert isinstance(org, Org)
            account_id = org.account.id
            subscription = org.subscription
            if subscription is None:
                logger.info(f"Org '{owner_name}' does not have a subscription")
                # Give the org a free subscription
                org.subscription = OrgSubscription(
                    plan_id=0,
                    n_users=1,
                    price=0.0,
                    period_months=1,
                    subscriber_user_id=current_user.id,
                    org_id=org.id,
                )
                session.add(org.subscription)
                session.commit()
                session.refresh(org.subscription)
                subscription = org.subscription
            # Check access to the org
            role = None
            for membership in current_user.org_memberships:
                if membership.org.account.name.lower() == owner_name.lower():
                    role = membership.role_name
            # If we have no role defined, check on GitHub
            # TODO
            if role not in ["owner", "admin"]:
                logger.info("User is not an admin or owner of this org")
                raise HTTPException(
                    403,
                    (
                        "Must be an owner or admin of an org to create "
                        "projects for it"
                    ),
                )
            owner_account_id = org.account.id
        else:
            owner_account_id = current_user.account.id
        project = Project.model_validate(
            project_in, update={"owner_account_id": owner_account_id}
        )
        logger.info("Adding project to database")
        session.add(project)
        session.commit()
        session.refresh(project)
    return project


class ProjectOptionalExtended(ProjectPublic):
    calkit_info_keys: list[str] | None = None
    readme_content: str | None = None


@router.get("/projects/{owner_name}/{project_name}")
def get_project(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUserOptional,
    get_extended_info: bool = False,
) -> ProjectOptionalExtended:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    resp = ProjectOptionalExtended.model_validate(project)
    # Get some more information about the project, e.g., its status, what
    # attributes are defined in calkit.yaml, its README content, questions,
    # etc., so we don't need to make other calls for these?
    if get_extended_info:
        logger.info(f"Getting extended info for {owner_name}/{project_name}")
        repo = get_repo(
            project=project,
            user=current_user,
            session=session,
            ttl=DEFAULT_REPO_TTL,
        )
        ck_info = get_ck_info_from_repo(repo=repo)
        resp.calkit_info_keys = list(ck_info.keys())
        # Read status if present
        status_fpath = os.path.join(repo.working_dir, ".calkit", "status.csv")
        if os.path.isfile(status_fpath):
            logger.info("Reading latest status")
            last_line = app.read_last_line_from_csv(status_fpath)
            if len(last_line) >= 3:
                # Insert status into database so it can be searched on
                logger.info("Updating status in database")
                updated = last_line[0]
                status = last_line[1]
                message = last_line[2]
                project.status = status
                project.status_updated = updated
                project.status_message = message
                session.commit()
                # TODO: Detect the Git email used to create the status?
    return resp


class ProjectPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    is_public: bool | None = None


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
    if req.is_public is not None:
        project.is_public = req.is_public
        visibility = "public" if req.is_public else "private"
        # Make call to GitHub API to change repo visibility
        gh_owner, gh_repo = project.git_repo_url.split("/")[-2:]
        url = f"https://api.github.com/repos/{gh_owner}/{gh_repo}"
        token = users.get_github_token(session=session, user=current_user)
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.patch(
            url,
            json={"visibility": visibility},
            headers=headers,
        )
        if resp.status_code != 200:
            logger.warning(
                "Failed to change repo visibility for "
                f"{owner_name}/{project_name}: {resp.text}"
            )
            raise HTTPException(
                resp.status_code, "Failed to change GitHub repo visibility"
            )
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
    project = get_project(
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
    mixpanel.user_dvc_pushed(
        user=current_user, owner_name=owner_name, project_name=project_name
    )
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
    # Check if user has not exceeded their storage limit
    fs = get_object_fs()
    storage_limit_gb = project.owner.subscription.storage_limit
    # Create bucket if it doesn't exist -- only necessary with MinIO
    if settings.ENVIRONMENT == "local" and not fs.exists(get_data_prefix()):
        fs.makedir(get_data_prefix())
    storage_used_gb = get_storage_usage(owner_name, fs=fs)
    logger.info(
        f"{owner_name} has used {storage_used_gb}/{storage_limit_gb} "
        "GB of storage"
    )
    if storage_used_gb > storage_limit_gb:
        logger.info("Rejecting request due to storage limit exceeded")
        mixpanel.user_out_of_storage(user=current_user)
        raise HTTPException(400, "Storage limit exceeded")
    # TODO: Create presigned PUT to upload the file so it doesn't need to pass
    # through this server
    fpath = make_data_fpath(
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
        remove_gcs_content_type(pending_fpath)
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
    mixpanel.user_dvc_pulled(
        user=current_user, owner_name=owner_name, project_name=project_name
    )
    logger.info(f"{current_user.email} requesting to GET data")
    app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    # If file doesn't exist, return 404
    fs = get_object_fs()
    fpath = make_data_fpath(
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
    app.projects.get_project(
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
    app.projects.get_project(
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


@router.get("/projects/{owner_name}/{project_name}/contents/{path:path}")
@router.get("/projects/{owner_name}/{project_name}/contents")
def get_project_contents(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUserOptional,
    path: str | None = None,
    ttl: int | None = DEFAULT_REPO_TTL,
) -> ContentsItem:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    # Get the repo
    # TODO: Stop using a TTL and rely on latest commit hash
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=ttl
    )
    return app.projects.get_contents_from_repo(
        project=project, repo=repo, path=path
    )


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
    current_user: CurrentUserOptional,
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
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
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
    current_user: CurrentUserOptional,
    session: SessionDep,
) -> list[Figure]:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
    )
    ck_info = get_ck_info_from_repo(repo)
    figures = ck_info.get("figures", [])
    if not figures:
        return figures
    # Get the figure content and base64 encode it
    for fig in figures:
        item = app.projects.get_contents_from_repo(
            project=project,
            repo=repo,
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
    current_user: CurrentUserOptional,
    session: SessionDep,
    ttl: int | None = DEFAULT_REPO_TTL,
) -> Figure:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=ttl
    )
    return app.projects.get_figure_from_repo(
        project=project, repo=repo, path=figure_path
    )


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
        fs = get_object_fs()
        fpath = make_data_fpath(
            owner_name=owner_name,
            project_name=project_name,
            idx=md5[:2],
            md5=md5[2:],
        )
        with fs.open(fpath, "wb") as f:
            f.write(file_data)
        if settings.ENVIRONMENT != "local":
            remove_gcs_content_type(fpath)
        url = get_object_url(fpath=fpath, fname=os.path.basename(path))
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
    current_user: CurrentUserOptional,
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
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
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
    current_user: CurrentUserOptional,
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
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
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
    current_user: CurrentUserOptional,
    session: SessionDep,
    filter_paths: list[str] | None = Query(default=None),
) -> DatasetForImport:
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
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
    )
    git_rev = repo.git.rev_parse(["HEAD"])
    repo_dir = repo.working_dir
    ck_info = get_ck_info_from_repo(repo)
    datasets = ck_info.get("datasets", [])
    # First check if this path is even a dataset
    ds = None
    for dsi in datasets:
        if dsi.get("path") == path:
            ds = dsi
            break
    if ds is None:
        raise HTTPException(404, f"Dataset at path {path} does not exist")
    # Is this dataset tracked with Git?
    # If so, our response will be different
    git_files = repo.git.ls_files(path)
    if git_files:
        git_files = git_files.split("\n")
    else:
        git_files = []
    if git_files:
        logger.info(f"Dataset at {path} is kept in Git")
        if filter_paths:
            logger.info(f"Filtering paths for patterns: {filter_paths}")
            filtered_git_files = []
            for f in git_files:
                for pattern in filter_paths:
                    if fnmatch(f, pattern) and f not in filtered_git_files:
                        filtered_git_files.append(f)
            git_files = filtered_git_files
        git_import = dict(files=git_files)
        return DatasetForImport.model_validate(
            ds | dict(git_import=git_import, git_rev=git_rev)
        )
    # The dataset is not in Git, so check DVC
    # Load DVC pipeline and lock files if they exist
    dvc_out = dict(
        remote=f"calkit:{owner_name}/{project_name}",
        push=False,
    )
    dvc_lock_fpath = os.path.join(repo_dir, "dvc.lock")
    dvc_lock = {}
    if os.path.isfile(dvc_lock_fpath):
        with open(dvc_lock_fpath) as f:
            dvc_lock = yaml.safe_load(f)
        # Expand all DVC lock outs
        fs = get_object_fs()
        dvc_lock_outs = expand_dvc_lock_outs(
            dvc_lock,
            owner_name=owner_name,
            project_name=project_name,
            fs=fs,
            get_sizes=True,
        )
        logger.info(f"Read {len(dvc_lock_outs)} DVC lock outputs")
    else:
        dvc_lock_outs = {}
    # Create the DVC import object
    # We need to know the MD5 hash
    stage_name = ds.get("stage")
    if stage_name is None:
        logger.info("No stage defined for dataset")
        dvc_fp = os.path.join(repo_dir, path + ".dvc")
        if os.path.isfile(dvc_fp):
            logger.info(f"Repo has a .dvc file for {path}")
            with open(dvc_fp) as f:
                dvo = yaml.safe_load(f)["outs"][0]
            dvc_out |= dvo
            ds["dvc_import"] = dict(outs=[dvc_out])
            ds["git_rev"] = git_rev
            return DatasetForImport.model_validate(ds)
        elif path in dvc_lock_outs:
            logger.info(f"Found {path} in DVC lock outputs")
            dvo = dvc_lock_outs[path]
            dvc_out |= dvo
            ds["dvc_import"] = dict(outs=[dvc_out])
            ds["git_rev"] = git_rev
            return DatasetForImport.model_validate(ds)
        else:
            # No stage and no .dvc file -- error
            logger.info("No stage nor .dvc file found")
            raise HTTPException(404)
    else:
        logger.info(f"Looking up contents based on stage {stage_name}")
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
        out = output_from_pipeline(
            path=path,
            stage_name=stage_name,
            pipeline=pipeline,
            lock=dvc_lock,
        )
        if out is None:
            logger.info("Searching through DVC lock outs")
            if path in dvc_lock_outs:
                logger.info(f"Found {path} in DVC lock outputs")
                if filter_paths is not None:
                    filtered_outs = []
                    filtered_paths = []
                    # The out should now be a list of outs
                    for fpath, out_i in dvc_lock_outs.items():
                        for pattern in filter_paths:
                            if (
                                fnmatch(fpath, pattern)
                                and fpath not in filtered_paths
                                and out_i.get("type") == "file"
                            ):
                                filtered_paths.append(fpath)
                                filtered_outs.append(out_i)
                    out = filtered_outs
                else:
                    out = dvc_lock_outs[path]
        if out is None:
            logger.info("Cannot find DVC object")
            raise HTTPException(400, "Cannot find DVC object")
        if isinstance(out, list):
            if not out:
                logger.info("Filtered data is empty")
                raise HTTPException(400, "Filtered data is empty")
            logger.info(f"Creating outs from filtered: {out}")
            dvc_outs = [dvc_out | out_i for out_i in out]
            ds["dvc_import"] = dict(outs=dvc_outs)
        else:
            dvc_out |= out
            ds["dvc_import"] = dict(outs=[dvc_out])
        ds["git_rev"] = git_rev
        return DatasetForImport.model_validate(ds)


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
        f"Received dataset file {path} with content type: {file.content_type}"
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
    fs = get_object_fs()
    fpath = make_data_fpath(
        owner_name=owner_name,
        project_name=project_name,
        idx=md5[:2],
        md5=md5[2:],
    )
    with fs.open(fpath, "wb") as f:
        f.write(file_data)
    if settings.ENVIRONMENT != "local":
        remove_gcs_content_type(fpath)
    url = get_object_url(fpath=fpath, fname=os.path.basename(path))
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


@router.get("/projects/{owner_name}/{project_name}/publications")
def get_project_publications(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
) -> list[Publication]:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
    )
    ck_info = get_ck_info_from_repo(repo)
    pipeline = get_dvc_pipeline_from_repo(repo)
    publications = ck_info.get("publications", [])
    resp = []
    for pub in publications:
        if "stage" in pub:
            pub["stage_info"] = pipeline.get("stages", {}).get(pub["stage"])
        # See if we can fetch the content for this publication
        if "path" in pub:
            try:
                item = app.projects.get_contents_from_repo(
                    project=project, repo=repo, path=pub["path"]
                )
                pub["content"] = item.content
                # Prioritize URL if already defined
                if "url" not in pub:
                    pub["url"] = item.url
            except HTTPException as e:
                logger.warning(
                    f"Failed to get publication at path {pub['path']}: {e}"
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
    template: Optional[Annotated[str, Form()]] = Form(None),
    environment: Optional[Annotated[str, Form()]] = Form(None),
    file: Optional[Annotated[UploadFile, File()]] = Form(None),
) -> Publication:
    if file is not None:
        logger.info(
            f"Received publication file {path} with content type: "
            f"{file.content_type}"
        )
    else:
        logger.info(f"Received request to create publication at {path}")
    if file is not None and stage is not None:
        raise HTTPException(
            400, "DVC outputs should be uploaded with `calkit push`"
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
    elif template is not None:
        # TODO: Centralize template names
        if template not in ["latex/article", "latex/jfm"]:
            raise HTTPException(422, "Invalid template name")
        cmd = [
            "calkit",
            "new",
            "publication",
            path,
            "--no-commit",
            "--kind",
            kind,
            "--title",
            title,
            "--description",
            description,
            "--template",
            template,
        ]
        if stage is not None:
            cmd += ["--stage", stage]
        if environment is not None:
            cmd += ["--environment", environment]
        subprocess.check_call(cmd, cwd=repo.working_dir)
    elif not os.path.isfile(os.path.join(repo.working_dir, path)):
        raise HTTPException(
            400, "File must exist in repo if not being uploaded"
        )
    # Only update publications if template is None, since when a template is
    # used, this was already done in `calkit new publication`
    if template is None:
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
        fs = get_object_fs()
        fpath = make_data_fpath(
            owner_name=owner_name,
            project_name=project_name,
            idx=md5[:2],
            md5=md5[2:],
        )
        with fs.open(fpath, "wb") as f:
            f.write(file_data)
        if settings.ENVIRONMENT != "local":
            remove_gcs_content_type(fpath)
        url = get_object_url(fpath=fpath, fname=os.path.basename(path))
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


class OverleafPublicationPost(BaseModel):
    path: str
    overleaf_project_url: str
    kind: Literal[
        "journal-article",
        "conference-paper",
        "report",
        "book",
        "masters-thesis",
        "phd-thesis",
        "other",
    ]
    title: str | None = None
    description: str | None = None
    target_path: str | None = None
    sync_paths: list[str] = []
    push_paths: list[str] = []
    stage_name: str | None = None
    environment_name: str | None = None
    overleaf_token: str | None = None


@router.post("/projects/{owner_name}/{project_name}/publications/overleaf")
def post_project_overleaf_publication(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    req: OverleafPublicationPost,
) -> Publication:
    """Import a publication from Overleaf into a project."""
    if req.overleaf_token is not None:
        users.save_overleaf_token(
            session=session,
            user=current_user,
            token=req.overleaf_token,
            expires=None,
        )
    if current_user.overleaf_token is None:
        raise HTTPException(400, "No Overleaf token found")
    if req.path == ".":
        raise HTTPException(400, "Path cannot be parent directory")
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
    if os.path.exists(os.path.join(repo.working_dir, req.path)):
        raise HTTPException(
            400, f"Path '{req.path}' already exists in the repo"
        )
    # Handle projects that aren't yet Calkit projects
    ck_info = get_ck_info_from_repo(repo)
    publications = ck_info.get("publications", [])
    # Make sure a publication with this path doesn't already exist
    pubpaths = [pub.get("path") for pub in publications]
    if req.path in pubpaths:
        raise HTTPException(400, "A publication already exists at this path")
    # Make sure we don't already have a stage with the same name
    pipeline = ck_info.get("pipeline", {})
    stages = pipeline.get("stages", {})
    stage_name = req.stage_name or f"build-{req.path}"
    if stage_name and stage_name in stages:
        raise HTTPException(
            400, f"A stage named '{stage_name}' already exists; please provide"
        )
    # Check environment spec, auto-detecting a TeXlive env to use
    envs = ck_info.get("environments", {})
    env_name = req.environment_name
    if not env_name:
        for en, e in envs.items():
            if e.get("kind") == "docker" and "texlive" in e.get("image", ""):
                env_name = en
                logger.info(f"Detected TeXlive env '{en}'")
                break
    elif env_name and env_name in envs:
        env = envs[env_name]
        if env.get("kind") != "docker" and "texlive" not in env.get(
            "image", ""
        ):
            raise HTTPException(
                400,
                f"Environment {env_name} exists, but is not a "
                "TeXLive Docker environment",
            )
    else:
        if not env_name:
            env_name = "tex"
            n = 1
            while env_name in envs:
                env_name = f"tex-{n}"
                n += 1
        env = {"kind": "docker", "image": "texlive/texlive:latest-full"}
        envs[env_name] = env
        ck_info["environments"] = envs
    # Get the Overleaf repo
    overleaf_project_id = req.overleaf_project_url.split("/")[-1]
    overleaf_repo = get_overleaf_repo(
        project=project,
        user=current_user,
        session=session,
        overleaf_project_id=overleaf_project_id,
    )
    # If target path was not supplied, see if we can detect it
    target_path = req.target_path
    if not target_path:
        overleaf_files = os.listdir(overleaf_repo.working_dir)
        for candidate in ["main.tex", "paper.tex", "report.tex"]:
            if candidate in overleaf_files:
                target_path = candidate
                break
    if not target_path:
        raise HTTPException(
            400, "Target path cannot be detected; please specify"
        )
    logger.info(f"Using target path: {target_path}")
    if not target_path.endswith(".tex"):
        raise HTTPException(400, "Target path must end with '.tex'")
    if target_path not in os.listdir(overleaf_repo.working_dir):
        raise HTTPException(
            400,
            f"Target path '{target_path}' does not exist in Overleaf project",
        )
    # See if we can detect the title
    title = req.title
    if not title:
        with open(os.path.join(overleaf_repo.working_dir, target_path)) as f:
            overleaf_target_text = f.read()
        texsoup = TexSoup(overleaf_target_text)
        title = str(texsoup.title.string) if texsoup.title else None
    if not title:
        raise HTTPException(400, "Title cannot be detected; please provide")
    # Create build stage
    input_rel_paths = set(
        os.listdir(overleaf_repo.working_dir) + req.sync_paths + req.push_paths
    )
    input_paths = []
    for p in input_rel_paths:
        if p == target_path or p.startswith("."):
            continue
        project_rel_path = os.path.join(req.path, p)
        if project_rel_path not in input_paths:
            input_paths.append(project_rel_path)
    stage = {
        "kind": "latex",
        "target_path": os.path.join(req.path, target_path),
        "environment": env_name,
        "inputs": input_paths,
    }
    stages[stage_name] = stage
    pipeline["stages"] = stages
    ck_info["pipeline"] = pipeline
    # Create publication object
    pdf_output_path = os.path.join(
        req.path, target_path.removesuffix(".tex") + ".pdf"
    )
    publication = {
        "path": pdf_output_path,
        "title": title,
        "description": req.description,
        "stage": stage_name,
        "overleaf": {
            "project_id": overleaf_project_id,
            "wdir": req.path,
            "sync_paths": req.sync_paths,
            "push_paths": req.push_paths,
        },
    }
    publications.append(publication)
    ck_info["publications"] = publications
    # Save last Overleaf repo sync commit
    last_overleaf_sync_commit = overleaf_repo.head.commit.hexsha
    publication["overleaf"]["last_sync_commit"] = last_overleaf_sync_commit
    # Actually copy in the files
    shutil.copytree(
        src=overleaf_repo.working_dir,
        dst=os.path.join(repo.working_dir, req.path),
        ignore=lambda src, names: [".git"],
    )
    # Add a sane LaTeX .gitignore file for the subdir
    gitignore_txt = ""
    for line in [
        "*.log",
        "*.synctex.gz",
        "*.aux",
        "*.toc",
        "*.out",
        "*.bbl",
        "*.fdb_latexmk",
        "*.blg",
        "*.rej",
        "*.tdo",
        "*.fls",
        "*.nav",
    ]:
        gitignore_txt += line + "\n"
    with open(
        os.path.join(repo.working_dir, req.path, ".gitignore"), "w"
    ) as f:
        f.write(gitignore_txt)
    # Make sure we ignore the private clone repo for local Overleaf syncs
    if not repo.ignored(".calkit/overleaf/"):
        logger.info("Adding .calkit/overleaf/ to .gitignore")
        with open(os.path.join(repo.working_dir, ".gitignore"), "a") as f:
            f.write("\n.calkit/overleaf/\n")
        repo.git.add(".gitignore")
    # Save and commit calkit.yaml
    with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    repo.git.add(req.path)
    # Compile DVC pipeline
    logger.info("Compiling DVC pipeline")
    subprocess.run(
        ["calkit", "check", "pipeline", "--compile"], cwd=repo.working_dir
    )
    repo.git.add("dvc.yaml")
    repo.git.commit(
        [
            "-m",
            f"Import Overleaf project ID {overleaf_project_id} to '{req.path}'",
        ]
    )
    repo.git.push(["origin", repo.active_branch.name])
    return Publication.model_validate(publication)


class OverleafSyncPost(BaseModel):
    path: str


class OverleafSyncResponse(BaseModel):
    commits_from_overleaf: int
    overleaf_commit: str
    project_commit: str
    committed_overleaf: bool
    committed_project: bool


@router.post("/projects/{owner_name}/{project_name}/overleaf-syncs")
def post_project_overleaf_sync(
    owner_name: str,
    project_name: str,
    req: OverleafSyncPost,
    current_user: CurrentUser,
    session: SessionDep,
) -> OverleafSyncResponse:
    if current_user.overleaf_token is None:
        raise HTTPException(401, "Overleaf token not found")
    pub_path = req.path
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="write",
    )
    repo = get_repo(project=project, user=current_user, session=session)
    ck_info = get_ck_info_from_repo(repo)
    publications = ck_info.get("publications", [])
    publication = None
    for pub in publications:
        if pub.get("path") == pub_path:
            publication = pub
            break
    if publication is None:
        raise HTTPException(404, "Publication not found")
    if "overleaf" not in publication:
        raise HTTPException(400, "Publication is not linked to Overleaf")
    if "project_id" not in publication["overleaf"]:
        raise HTTPException(400, "Overleaf project ID missing")
    overleaf_project_id = publication["overleaf"]["project_id"]
    wdir = publication["overleaf"].get("wdir", os.path.dirname(pub_path))
    overleaf_repo = get_overleaf_repo(
        project=project,
        user=current_user,
        session=session,
        overleaf_project_id=overleaf_project_id,
    )
    last_sync_commit = publication["overleaf"].get("last_sync_commit")
    if publication["overleaf"].get("dvc_sync_paths"):
        raise HTTPException(400, "Cannot sync DVC paths")
    sync_paths = publication["overleaf"].get("sync_paths", [])
    push_paths = publication["overleaf"].get("push_paths", [])
    # From calkit-python
    overleaf_project_dir = overleaf_repo.working_dir
    project_wdir = os.path.join(repo.working_dir, wdir)
    implicit_sync_paths = os.listdir(overleaf_repo.working_dir)
    for p in implicit_sync_paths:
        if p.startswith("."):
            continue
        if p not in sync_paths:
            sync_paths.append(p)
            if p not in sync_paths:
                sync_paths.append(p)
    git_sync_paths = sync_paths
    git_sync_paths_in_project = [
        os.path.join(project_wdir, p) for p in sync_paths
    ]
    if last_sync_commit:
        logger.info(f"Syncing since {last_sync_commit}")
        commits_since = list(
            overleaf_repo.iter_commits(rev=f"{last_sync_commit}..HEAD")
        )
        # Compute a patch in the Overleaf project between HEAD and the last
        # sync
        patch = overleaf_repo.git.format_patch(
            [f"{last_sync_commit}..HEAD", "--stdout", "--"] + git_sync_paths
        )
        # Replace any Overleaf commit messages to make them more meaningful
        patch = patch.replace(
            "Update on Overleaf.", f"Update {wdir} on Overleaf"
        )
        # Ensure the patch ends with a new line
        if patch and not patch.endswith("\n"):
            patch += "\n"
        if patch:
            logger.info("Applying Overleaf Git patch to project repo")
            try:
                subprocess.run(
                    [
                        "git",
                        "am",
                        "--3way",
                        "--directory",
                        wdir,
                        "-",
                    ],
                    input=patch,
                    text=True,
                    encoding="utf-8",
                    capture_output=True,
                    check=True,
                    cwd=repo.working_dir,
                )
            except Exception as e:
                logger.info(f"Failed to sync: {e}")
                if "in the middle of an am session" in repo.git.status():
                    repo.git.am("--abort")
                mixpanel.track(
                    user=current_user,
                    event_name="Overleaf sync failed",
                    add_event_info={"pub_path": pub_path, "exception": str(e)},
                )
                raise HTTPException(
                    400, "Overleaf sync failed; try locally with Calkit CLI"
                )
    else:
        # Simply copy in all files
        logger.info("Copying in all files from Overleaf")
        commits_since = []
        for sync_path in sync_paths:
            src = os.path.join(overleaf_project_dir, sync_path)
            dst = os.path.join(project_wdir, sync_path)
            if os.path.isdir(src):
                # Copy the directory and its contents
                shutil.copytree(src, dst, dirs_exist_ok=True)
            elif os.path.isfile(src):
                # Copy the file
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)
            else:
                raise HTTPException(
                    400,
                    f"Source path {src} does not exist; "
                    "please check your Overleaf config",
                )
    # Copy our versions of sync and push paths into the Overleaf project
    for sync_push_path in sync_paths + push_paths:
        src = os.path.join(project_wdir, sync_push_path)
        dst = os.path.join(overleaf_project_dir, sync_push_path)
        if os.path.isdir(src):
            # Remove destination directory if it exists
            if os.path.isdir(dst):
                shutil.rmtree(dst)
            # Copy the directory and its contents
            shutil.copytree(src, dst, dirs_exist_ok=True)
        elif os.path.isfile(src):
            # Copy the file
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
        elif os.path.isfile(dst) and not os.path.isfile(src):
            # Handle newly created files on Overleaf, i.e., they exist
            # in dst but not in src
            os.makedirs(os.path.dirname(src), exist_ok=True)
            shutil.copy2(dst, src)
        else:
            raise HTTPException(
                400,
                f"Source path {src} does not exist; "
                "please check your Overleaf config",
            )
            continue
    # Stage the changes in the Overleaf project
    overleaf_repo.git.add(sync_paths + push_paths)
    committed_overleaf = False
    if overleaf_repo.git.diff("--staged", sync_paths + push_paths):
        commit_message = "Sync with Calkit project"
        overleaf_repo.git.commit(
            *(sync_paths + push_paths),
            "-m",
            commit_message,
        )
        overleaf_repo.git.push()
        committed_overleaf = True
    # Update the last sync commit
    last_overleaf_commit = overleaf_repo.head.commit.hexsha
    logger.info(f"Updating last sync commit as {last_overleaf_commit}")
    publication["overleaf"]["last_sync_commit"] = last_overleaf_commit
    # Write publications back to calkit.yaml
    ck_info["publications"] = publications
    with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
        calkit.ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    # Stage the changes in the project repo
    repo.git.add(git_sync_paths_in_project)
    committed_project = False
    if repo.git.diff("--staged", git_sync_paths_in_project + ["calkit.yaml"]):
        commit_message = f"Sync {wdir} with Overleaf project"
        repo.git.commit(
            *(git_sync_paths_in_project + ["calkit.yaml"]),
            "-m",
            commit_message,
        )
        repo.git.push(["origin", repo.active_branch.name])
        committed_project = True
    return OverleafSyncResponse(
        commits_from_overleaf=len(commits_since),
        overleaf_commit=last_overleaf_commit,
        project_commit=repo.head.commit.hexsha,
        committed_overleaf=committed_overleaf,
        committed_project=committed_project,
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


@router.get("/projects/{owner_name}/{project_name}/pipeline")
def get_project_pipeline(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
) -> Pipeline | None:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
    )
    fpath = os.path.join(repo.working_dir, "dvc.yaml")
    if not os.path.isfile(fpath):
        return
    with open(fpath) as f:
        dvc_content = f.read()
    dvc_pipeline = ryaml.load(dvc_content)
    # Pop off any private stages
    for stage_name in list(dvc_pipeline.get("stages", {}).keys()):
        if stage_name.startswith("_"):
            dvc_pipeline["stages"].pop(stage_name)
    params_fpath = os.path.join(repo.working_dir, "params.yaml")
    if os.path.isfile(params_fpath):
        with open(params_fpath) as f:
            params = ryaml.load(f)
    else:
        params = None
    # Generate Mermaid diagram
    mermaid = make_mermaid_diagram(dvc_pipeline, params=params)
    logger.info(
        f"Created Mermaid diagram for {owner_name}/{project_name}:\n{mermaid}"
    )
    # See if we can read a Calkit pipeline
    ck_fpath = os.path.join(repo.working_dir, "calkit.yaml")
    calkit_content = None
    if os.path.isfile(ck_fpath):
        with open(ck_fpath) as f:
            ck_info = ryaml.load(f)
        if "pipeline" in ck_info:
            stream = io.StringIO()
            ryaml.dump({"pipeline": ck_info["pipeline"]}, stream)
            calkit_content = stream.getvalue()
    return Pipeline(
        dvc_stages=dvc_pipeline["stages"],
        mermaid=mermaid,
        dvc_yaml=dvc_content,
        calkit_yaml=calkit_content,
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
    github_repo = project.github_repo
    if github_repo is None:
        raise HTTPException(501)
    url = f"https://api.github.com/repos/{github_repo}/collaborators"
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
    user = session.exec(
        select(User)
        .join(User.account)
        .where(Account.github_name == github_username)
    ).first()
    logger.info(
        f"Fetched user account {user.email} with GitHub username "
        f"{github_username}"
    )
    if user is None:
        raise HTTPException(404, "User not found")
    token = users.get_github_token(session=session, user=current_user)
    url = (
        f"https://api.github.com/repos/{project.github_repo}/"
        f"collaborators/{github_username}"
    )
    resp = requests.put(url, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code >= 400:
        logger.error(
            f"Failed to put collaborator ({resp.status_code}): {resp.text}"
        )
        raise HTTPException(resp.status_code)
    access = session.exec(
        select(UserProjectAccess)
        .where(UserProjectAccess.user_id == user.id)
        .where(UserProjectAccess.project_id == project.id)
    ).first()
    if access is not None:
        access.access = "write"
    else:
        session.add(
            UserProjectAccess(
                user_id=user.id, project_id=project.id, access="write"
            )
        )
    session.commit()
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
    user = session.exec(
        select(User)
        .join(User.account)
        .where(Account.github_name == github_username)
    ).first()
    logger.info(
        f"Fetched user account {user.email} with GitHub username "
        f"{github_username}"
    )
    if user is None:
        raise HTTPException(404, "User not found")
    token = users.get_github_token(session=session, user=current_user)
    url = (
        f"https://api.github.com/repos/{project.github_repo}/"
        f"collaborators/{github_username}"
    )
    resp = requests.delete(url, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code >= 400:
        logger.error(
            f"Failed to delete collaborator ({resp.status_code}): {resp.text}"
        )
        raise HTTPException(resp.status_code)
    access = session.exec(
        select(UserProjectAccess)
        .where(UserProjectAccess.user_id == user.id)
        .where(UserProjectAccess.project_id == project.id)
    ).first()
    if access is not None:
        access.access = None
    else:
        session.add(
            UserProjectAccess(
                user_id=user.id, project_id=project.id, access=None
            )
        )
    session.commit()
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
    current_user: CurrentUserOptional,
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
    github_repo = project.github_repo
    headers = None
    if github_repo is None:
        raise HTTPException(501)
    if current_user is not None:
        token = users.get_github_token(session=session, user=current_user)
        headers = {"Authorization": f"Bearer {token}"}
    url = f"https://api.github.com/repos/{github_repo}/issues"
    resp = requests.get(
        url,
        headers=headers,
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
    url = f"https://api.github.com/repos/{project.github_repo}/issues"
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
        f"https://api.github.com/repos/{project.github_repo}/"
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
    current_user: CurrentUserOptional,
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
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
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
                        contents_item = app.projects.get_contents_from_repo(
                            project=project,
                            repo=repo,
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
    name: str
    kind: str
    path: str | None = None
    description: str | None = None
    imported_from: str | None = None
    all_attrs: dict
    file_content: str | None = None


@router.get("/projects/{owner_name}/{project_name}/environments")
def get_project_environments(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
) -> list[Environment]:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
    )
    ck_info = get_ck_info_from_repo(repo, process_includes=True)
    envs = ck_info.get("environments", {})
    resp = []
    for env_name, env in envs.items():
        env_resp = env | {"all_attrs": env}
        env_resp["name"] = env_name
        env_path = env.get("path")
        if env_path:
            fpath = os.path.join(repo.working_dir, env_path)
            if os.path.isfile(fpath):
                with open(fpath) as f:
                    env_resp["file_content"] = f.read()
        try:
            resp.append(Environment.model_validate(env_resp))
        except ValidationError as e:
            logger.warning(f"Invalid environment: {e}")
    return resp


@router.post("/projects/{owner_name}/{project_name}/environments")
def post_project_environment(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    req: Environment,
) -> Environment:
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
    envs = ck_info.get("environments", {})
    if req.name in envs:
        raise HTTPException(400, "Environment with same name already exists")
    new_env = req.all_attrs
    if req.imported_from and "imported_from" not in new_env:
        new_env["imported_from"] = req.imported_from
    envs[req.name] = new_env
    ck_info["environments"] = envs
    fpath = os.path.join(repo.working_dir, "calkit.yaml")
    with open(fpath, "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    if req.path and req.file_content:
        fpath = os.path.join(repo.working_dir, req.path)
        os.makedirs(os.path.dirname(fpath), exist_ok=True)
        with open(fpath, "w") as f:
            f.write(req.file_content)
        repo.git.add(fpath)
    repo.git.commit(["-m", f"Add environment {req.name}"])
    repo.git.push(["origin", repo.active_branch])
    return Environment.model_validate(new_env | {"all_attrs": new_env})


class Software(BaseModel):
    environments: list[Environment]
    # TODO: Add scripts, packages, apps?


@router.get("/projects/{owner_name}/{project_name}/software")
def get_project_software(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
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
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
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


@router.get("/projects/{owner_name}/{project_name}/notebooks")
def get_project_notebooks(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
) -> list[Notebook]:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
    )
    ck_info = get_ck_info_from_repo(repo)
    notebooks = ck_info.get("notebooks", [])
    if not notebooks:
        return notebooks
    # Get the notebook content and base64 encode it
    for notebook in notebooks:
        item = app.projects.get_contents_from_repo(
            project=project,
            repo=repo,
            path=notebook["path"],
        )
        try:
            # If the notebook has HTML output, return that
            html_path = get_executed_notebook_path(
                notebook_path=notebook["path"], to="html"
            )
            html_item = app.projects.get_contents_from_repo(
                project=project, repo=repo, path=html_path
            )
            item = html_item
            notebook["output_format"] = "html"
        except HTTPException as e:
            logger.info(f"Notebook HTML does not exist at {html_path}: {e}")
        notebook["url"] = item.url
        notebook["content"] = item.content
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


@router.get("/projects/{owner_name}/{project_name}/repro-check")
def get_project_repro_check(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
) -> ReproCheck:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
    )
    res = check_reproducibility(wdir=repo.working_dir)
    return res


@router.put("/projects/{owner_name}/{project_name}/devcontainer")
def put_project_dev_container(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
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
    subprocess.check_call(
        ["calkit", "update", "devcontainer"], cwd=repo.working_dir
    )
    repo.git.add(".devcontainer")
    if repo.git.diff("--staged"):
        repo.git.commit(["-m", "Add dev container spec"])
        repo.git.push(["origin", repo.active_branch])
    return Message(message="Success")


class ProjectApp(BaseModel):
    path: str | None = None
    url: str | None = None
    title: str | None = None
    description: str | None = None


@router.get("/projects/{owner_name}/{project_name}/app")
def get_project_app(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
) -> ProjectApp | None:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    ck_info = get_ck_info(
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
    )
    project_app = ck_info.get("app")
    if project_app is None:
        return
    return ProjectApp.model_validate(project_app)


@router.get("/projects/{owner_name}/{project_name}/showcase")
def get_project_showcase(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ttl: int | None = DEFAULT_REPO_TTL,
) -> Showcase | None:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    incorrectly_defined = Showcase(
        elements=[ShowcaseText(text="Showcase is not correctly defined.")]
    )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=ttl
    )
    ck_info = get_ck_info_from_repo(repo)
    showcase = ck_info.get("showcase")
    if showcase is None:
        return
    try:
        inputs = ShowcaseInput.model_validate(dict(elements=showcase))
    except Exception:
        return incorrectly_defined
    # Iterate over showcase elements, fetching the contents to return
    # Set TTL very high since we already fetched the repo above
    if ttl is None:
        ttl = 3600
    else:
        ttl = 30 * ttl
    elements_out = []
    for element_in in inputs.elements:
        if isinstance(element_in, ShowcaseFigureInput):
            try:
                element_out = ShowcaseFigure(
                    figure=app.projects.get_figure_from_repo(
                        project=project,
                        repo=repo,
                        path=element_in.figure,
                    )
                )
            except Exception as e:
                logger.warning(
                    f"Failed to get showcase figure from {element_in}: {e}"
                )
                element_out = ShowcaseText(
                    text=f"Figure at path '{element_in.figure}' not found"
                )
        elif isinstance(element_in, ShowcasePublicationInput):
            try:
                element_out = ShowcasePublication(
                    publication=app.projects.get_publication_from_repo(
                        project=project,
                        repo=repo,
                        path=element_in.publication,
                    )
                )
            except Exception as e:
                logger.warning(
                    "Failed to get showcase publication from "
                    f"{element_in}: {e}"
                )
                element_out = ShowcaseText(
                    text=(
                        f"Publication at path '{element_in.publication}' "
                        "not found"
                    )
                )
        elif isinstance(element_in, ShowcaseMarkdownFileInput):
            fpath = os.path.join(repo.working_dir, element_in.markdown_file)
            if os.path.isfile(fpath):
                with open(fpath) as f:
                    md = f.read()
                element_out = ShowcaseMarkdown(markdown=md)
            else:
                element_out = ShowcaseText(
                    text=(
                        f"Markdown file at path '{element_in.markdown_file}' "
                        "not found"
                    )
                )
        elif isinstance(element_in, ShowcaseYamlFileInput):
            fpath = os.path.join(repo.working_dir, element_in.yaml_file)
            if os.path.isfile(fpath):
                if element_in.object_name is None:
                    with open(fpath) as f:
                        txt = f.read()
                else:
                    with open(fpath) as f:
                        content = ryaml.load(f)
                    if content is None:
                        content = {}
                    obj = content.get(
                        element_in.object_name,
                        f"YAML object {element_in.object_name} not found.",
                    )
                    stream = StringIO()
                    ryaml.dump(obj, stream)
                    txt = stream.getvalue()
                element_out = ShowcaseYaml(yaml=txt)
            else:
                element_out = ShowcaseText(
                    text=(
                        f"YAML file at path '{element_in.yaml_file}' not found"
                    )
                )
        elif isinstance(element_in, ShowcaseNotebookInput):
            try:
                element_out = ShowcaseNotebook(
                    notebook=app.projects.get_notebook_from_repo(
                        project=project,
                        repo=repo,
                        path=element_in.notebook,
                    )
                )
            except Exception as e:
                logger.warning(
                    f"Failed to get showcase notebook from {element_in}: {e}"
                )
                element_out = ShowcaseText(
                    text=(
                        f"Notebook for path '{element_in.notebook}' not found"
                    )
                )
        else:
            element_out = element_in
        elements_out.append(element_out)
    return Showcase.model_validate(dict(elements=elements_out))


class GitHubRelease(BaseModel):
    url: str
    name: str
    tag_name: str
    body: str
    created: datetime
    published: datetime


@router.get("/projects/{owner_name}/{project_name}/github-releases")
def get_project_github_releases(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
) -> list[GitHubRelease]:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    if current_user is not None:
        token = users.get_github_token(session=session, user=current_user)
        headers = {"Authorization": f"Bearer {token}"}
    else:
        headers = None
    logger.info(f"Fetching GitHub releases for {owner_name}/{project_name}")
    url = f"https://api.github.com/repos/{project.github_repo}/releases"
    resp = requests.get(url, headers=headers)
    if resp.status_code >= 400:
        raise HTTPException(400, "Failed to fetch GitHub releases")
    resp2 = []
    for obj in resp.json():
        resp2.append(
            GitHubRelease(
                url=obj["html_url"],
                name=obj["name"],
                tag_name=obj["tag_name"],
                body=obj["body"],
                created=obj["created_at"],
                published=obj["published_at"],
            )
        )
    return resp2


class GitHubReleasePost(BaseModel):
    tag_name: str
    target_committish: str = "main"
    name: str | None = None
    body: str
    generate_release_notes: bool = True


@router.post("/projects/{owner_name}/{project_name}/github-releases")
def post_project_github_release(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    req: GitHubReleasePost,
) -> GitHubRelease:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="write",
    )
    token = users.get_github_token(session=session, user=current_user)
    headers = {"Authorization": f"Bearer {token}"}
    logger.info(
        f"Posting GitHub release {req.name} for {owner_name}/{project_name}"
    )
    if req.name is None:
        req.name = req.tag_name
    url = f"https://api.github.com/repos/{project.github_repo}/releases"
    resp = requests.post(url, json=req.model_dump(), headers=headers)
    if resp.status_code >= 400:
        raise HTTPException(400, "Failed to post GitHub release")
    obj = resp.json()
    return GitHubRelease(
        url=obj["html_url"],
        name=obj["name"],
        tag_name=obj["tag_name"],
        body=obj["body"],
        created=obj["created_at"],
        published=obj["published_at"],
    )


class ProjectStatusPost(BaseModel):
    status: Literal["in-progress", "on-hold", "completed"]
    message: str | None = None


@router.post("/projects/{owner_name}/{project_name}/status")
def post_project_status(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    req: ProjectStatusPost,
) -> ProjectStatus:
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
    logger.info(f"{current_user.email} setting project status to {req.status}")
    cmd = ["calkit", "new", "status", req.status]
    if req.message is not None:
        cmd += ["-m", req.message]
    try:
        subprocess.check_call(cmd, cwd=repo.working_dir)
        logger.info("Git pushing")
        repo.git.push(["origin", repo.active_branch])
    except Exception as e:
        logger.error(f"Failed to set project status: {e}")
        raise HTTPException(400, f"Failed to set project status: {e}")
    project.status = req.status
    project.status_message = req.message
    project.status_updated = app.utcnow()
    session.commit()
    session.refresh(project)
    return ProjectStatus(
        status=project.status,
        message=project.status_message,
        timestamp=project.status_updated,
    )
