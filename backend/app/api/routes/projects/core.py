"""Main routes for projects."""

import base64
import io
import json
import logging
import os
import shutil
import subprocess
import sys
import uuid
import zipfile
from copy import deepcopy
from datetime import datetime, timedelta
from fnmatch import fnmatch
from io import StringIO
from pathlib import Path, PurePosixPath
from typing import Annotated, Literal, Optional, cast
from urllib.parse import quote, urlparse

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
    UploadFile,
)
from git.exc import GitCommandError
from pydantic import BaseModel, ValidationError
from sqlmodel import Session, and_, func, not_, or_, select
from TexSoup import TexSoup

import app.projects
from app import github, messaging, mixpanel, orgs, users
from app.api.deps import (
    CurrentUser,
    CurrentUserOptional,
    SessionDep,
)
from app.api.routes.orgs import OrgPost, post_org
from app.config import settings
from app.security import generate_refresh_token, hash_refresh_token
from app.core import (
    CATEGORIES_PLURAL_TO_SINGULAR,
    CATEGORIES_SINGULAR_TO_PLURAL,
    params_from_url,
    ryaml,
    utcnow,
)
from app.dvc import (
    expand_dvc_lock_outs,
    make_mermaid_diagram,
    output_from_pipeline,
)
from app.pipeline import (
    color_mermaid_by_status,
    compute_stage_statuses,
    find_stage_for_path,
    calc_overall_pipeline_status,
)
from app.git import (
    get_ck_info,
    get_ck_info_from_repo,
    get_commit_history,
    get_file_history,
    get_overleaf_repo,
    get_repo,
    get_zip_path_map_from_repo,
    resolve_commit_sha,
    search_refs,
)
from app.models import (
    Account,
    ContentsItem,
    Dataset,
    DatasetForImport,
    Figure,
    FileLock,
    GitRef,
    Message,
    Notebook,
    Notification,
    Org,
    OrgSubscription,
    Pipeline,
    Project,
    ProjectComment,
    ProjectCommentPatch,
    ProjectCommentPost,
    ProjectInvitation,
    ProjectInvitationCreated,
    ProjectInvitationPost,
    ProjectInvitationPublic,
    ProjectInvitationRedeemed,
    ProjectPost,
    ProjectPublic,
    ProjectsPublic,
    Presentation,
    Publication,
    Question,
    QuestionEvidence,
    QuestionPublic,
    QuestionPut,
    Result,
    User,
    UserOrgMembership,
    UserProjectAccess,
)
from app.models.core import ROLE_IDS, ROLE_NAMES
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
    get_object_fs,
    get_object_url,
    make_data_fpath,
    remove_gcs_content_type,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

DEFAULT_REPO_TTL = 60  # Seconds
FULL_HISTORY_REPO_TTL = 10 * 60  # Seconds; history changes infrequently

FIGURE_EXTS = {".png", ".jpg", ".jpeg", ".svg", ".gif", ".pdf"}
FIGURE_DIRS = {"figures", "figure", "figs", "fig", "plots", "images"}

# Mirrors calkit-python's result detection (calkit/detect.py): data-like files
# under a results-style directory that aren't already figures.
RESULT_EXTS = {
    ".json",
    ".csv",
    ".tsv",
    ".yaml",
    ".yml",
    ".parquet",
    ".h5",
    ".hdf5",
    ".txt",
    ".html",
}
RESULT_DIRS = {"results", "result"}


def _title_from_path(path: str) -> str:
    """Derive a human-readable title from an artifact's file name."""
    # Repo paths are always Posix, so parse them as such regardless of host OS.
    stem = PurePosixPath(path).stem
    return stem.replace("_", " ").replace("-", " ").capitalize()


PRESENTATION_EXTS = {".pdf", ".pptx", ".ppt", ".key", ".odp"}
PRESENTATION_DIRS = {
    "slides",
    "slide",
    "presentation",
    "presentations",
    "talks",
    "talk",
    "decks",
    "deck",
}


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
            # A row in the unified access table with either a native Calkit
            # grant (role_id, e.g. an invite redemption) or GitHub-derived
            # access. A row with both null is a cached "no access" result.
            and_(
                UserProjectAccess.user_id == current_user.id,
                or_(
                    UserProjectAccess.role_id.is_not(None),  # type: ignore
                    UserProjectAccess.github_access.is_not(None),  # type: ignore
                ),
            ),
            Project.owner_account.has(  # type: ignore
                and_(
                    Account.org_id.is_not(None),  # type: ignore
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
            Project.owner_account.has(Account.name == owner_name.lower()),  # type: ignore
        )
    if search_for is not None:
        search_for = f"%{search_for}%"
        where_clause = and_(
            where_clause,
            or_(
                Project.name.ilike(search_for),  # type: ignore
                Project.title.ilike(search_for),  # type: ignore
                Project.description.ilike(search_for),  # type: ignore
                Project.git_repo_url.ilike(search_for),  # type: ignore
            ),
        )
    count_query = (
        select(func.count())
        .select_from(Project)
        .distinct()
        .join(Project.user_access_records, isouter=True)  # type: ignore
        .where(where_clause)
    )
    count = session.exec(count_query).one()
    select_query = (
        select(Project)
        .distinct()
        .join(Project.user_access_records, isouter=True)  # type: ignore
        .where(where_clause)
        .order_by(sqlalchemy.desc(Project.created))  # type: ignore
        .limit(limit)
        .offset(offset)
    )
    projects = session.exec(select_query).all()
    return ProjectsPublic(data=projects, count=count)  # type: ignore


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
        # A native Calkit grant (role_id), e.g. an invite redemption, the only
        # access path for GitHub-less collaborators.
        Project.user_access_records.any(  # type: ignore
            and_(
                UserProjectAccess.user_id == current_user.id,
                UserProjectAccess.role_id.is_not(None),
            )
        ),
        Project.owner_account.has(  # type: ignore
            and_(
                Account.org_id.is_not(None),  # type: ignore
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
                Project.name.ilike(search_for),  # type: ignore
                Project.title.ilike(search_for),  # type: ignore
                Project.description.ilike(search_for),  # type: ignore
                Project.git_repo_url.ilike(search_for),  # type: ignore
            ),
        )
    count_statement = (
        select(func.count()).select_from(Project).where(where_clause)
    )
    count = session.exec(count_statement).one()
    statement = (
        select(Project)
        .where(where_clause)
        .order_by(sqlalchemy.desc(Project.created))  # type: ignore
        .offset(offset)
        .limit(limit)
    )
    projects = session.exec(statement).all()
    return ProjectsPublic(data=projects, count=count)  # type: ignore


@router.post("/projects")
def post_project(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    project_in: ProjectPost,
) -> ProjectPublic:
    """Create new project."""
    # Project owners must have a linked GitHub account until git hosting is
    # decoupled from GitHub. GitHub-less users can still collaborate.
    if current_user.account.github_name is None:
        raise HTTPException(
            403,
            "A linked GitHub account is required to create or own projects.",
        )
    project_in.name = project_in.name.lower()
    if project_in.git_repo_exists and project_in.git_repo_url is None:
        raise HTTPException(
            400, "Git repo URL must be specified if Git repo exists"
        )
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
    # Validate the git repo URL is on github.com to prevent SSRF
    parsed_git_url = urlparse(project_in.git_repo_url)
    if parsed_git_url.hostname not in ("github.com", "www.github.com"):
        raise HTTPException(400, "Git repo URL must be on github.com")
    # Detect owner and repo name from Git repo URL
    # TODO: This should be generalized to not depend on GitHub?
    owner_name, repo_name = project_in.git_repo_url.split("/")[-2:]
    # Validate that the owner is either the current user or an org they belong
    # to before retrieving their GitHub token
    # This prevents users from using their token to make API calls for repos
    # they don't own
    is_user_org = False
    if owner_name != current_user.github_username:
        # Check if it's an org the user belongs to
        for membership in current_user.org_memberships:
            if (
                membership.org.account.github_name.lower()
                == owner_name.lower()
            ) and membership.role_name in ["owner", "admin", "write"]:
                is_user_org = True
                break
        if not is_user_org:
            raise HTTPException(
                403,
                "Can only create projects for yourself or organizations you "
                "belong to",
            )
    # Check if this user has exceeded their private projects limit if this one
    # is private
    if not project_in.git_repo_exists and not project_in.is_public:
        logger.info(f"Checking private project count for {owner_name}")
        if current_user.account.name == owner_name.lower():
            # Count private projects for user
            account_id = current_user.account.id
            subscription = current_user.subscription
        else:
            # Count private projects for an org
            # First check if this org exists in Calkit
            org = orgs.get_org_by_github_name(
                session=session, github_name=owner_name
            )
            if org is None:
                logger.info(f"Org '{owner_name}' does not exist in DB")
                # Try to create the org
                post_org(
                    req=OrgPost(github_name=owner_name),
                    session=session,
                    current_user=current_user,
                )
                org = orgs.get_org_by_github_name(
                    session=session, github_name=owner_name
                )
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
        if project_in.git_repo_exists:
            raise HTTPException(404, "GitHub repo not found")
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
        if is_user_org:
            post_url = f"https://api.github.com/orgs/{owner_name}/repos"
        else:
            post_url = "https://api.github.com/user/repos"
        resp = requests.post(post_url, json=body, headers=headers)
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
        # If this is an org, we need to get it's account ID
        if is_user_org:
            owner_org = orgs.get_org_by_github_name(
                session=session, github_name=owner_name
            )
            if owner_org is None:
                raise HTTPException(400, "Org not found")
            owner_account_id = owner_org.account.id
        else:
            owner_account_id = current_user.account.id
        add_info = {"owner_account_id": owner_account_id}
        if project_in.template is not None:
            add_info["parent_project_id"] = template_project.id
        project = Project.model_validate(project_in, update=add_info)
        logger.info("Adding project to database")
        session.add(project)
        session.commit()
        session.refresh(project)
        # Clone the repo and set up the Calkit DVC remote
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
        calkit.dvc.configure_remote(wdir=str(repo.working_dir), use_ck=True)
        repo.git.add(".dvc")
        if project_in.template is not None:
            commit_msg = f"Create new project from {project_in.template}"
        else:
            commit_msg = "Create README.md, DVC config, and calkit.yaml"
        repo.git.commit(["-m", commit_msg])
        repo.git.push(["origin", repo.active_branch.name])
    # Repo exists on GitHub
    elif resp.status_code == 200:
        logger.info(f"Repo exists on GitHub as {owner_name}/{repo_name}")
        if not project_in.git_repo_exists:
            raise HTTPException(400, "GitHub repo already exists")
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
            org = orgs.get_org_by_github_name(
                session=session, github_name=owner_name
            )
            if org is None:
                logger.info(f"Org '{owner_name}' does not exist in DB")
                # Try to create the org
                post_org(
                    req=OrgPost(github_name=owner_name),
                    session=session,
                    current_user=current_user,
                )
                org = orgs.get_org_by_github_name(
                    session=session, github_name=owner_name
                )
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
            # TODO: If we have no role defined, check on GitHub
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
        # Make public visibility match that on GitHub
        project_in.is_public = not repo.get("private", True)
        if not project_in.description:
            project_in.description = repo.get("description", None)
        project = Project.model_validate(
            project_in, update={"owner_account_id": owner_account_id}
        )
        logger.info("Adding project to database")
        session.add(project)
        session.commit()
        session.refresh(project)
    return project  # type: ignore


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
    ref: str | None = None,
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
            ref=ref,
        )
        # Read at the requested ref. get_repo only fetches a ref, it does
        # not check it out, so get_ck_info_from_repo (working tree) would
        # report the default branch's calkit.yaml keys instead.
        ck_info = app.projects.get_ck_info_for_ref(
            project=project, repo=repo, ref=ref
        )
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
) -> dict:
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


class GitRemoteHead(BaseModel):
    branch: str
    sha: str | None


@router.get("/projects/{owner_name}/{project_name}/git/remote-head")
def get_project_git_remote_head(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUser,
    branch: str | None = None,
) -> GitRemoteHead:
    """Return origin's current HEAD commit SHA for a branch.

    Lets the LaTeX editor detect that someone else has pushed (concurrent
    editing) by polling, without pulling or resetting the working tree. Uses
    ``git ls-remote`` (a cheap live query) on the cached clone, reusing its auth.
    """
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
        ttl=FULL_HISTORY_REPO_TTL,
    )
    branch_name = branch or repo.active_branch.name
    try:
        out = repo.git.ls_remote(["origin", branch_name])
    except GitCommandError:
        out = ""
    sha = out.split()[0].strip() if out.strip() else None
    return GitRemoteHead(branch=branch_name, sha=sha)


@router.get("/projects/{owner_name}/{project_name}/git/refs")
def search_project_refs(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUserOptional,
    q: Optional[str] = Query(None, description="Search query for refs"),
) -> list[GitRef]:
    """Get git refs (branches, tags, commits) in a project.

    Parameters
    ----------
    owner_name:
        Owner of the project.
    project_name:
        Name of the project.
    q:
        Optional search query to filter refs by branch name, tag name,
        commit message, or author.

    Returns
    -------
    list[GitRef]
        List of matching GitRef objects with name, kind, message, author,
        timestamp.
    """
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
        ttl=FULL_HISTORY_REPO_TTL,
    )
    refs = search_refs(repo, query=q)
    return cast(list[GitRef], refs)


@router.get("/projects/{owner_name}/{project_name}/git/history")
def get_project_history(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUserOptional,
    limit: int = Query(
        50, le=200, description="Max number of commits to return"
    ),
    offset: int = Query(0, description="Number of commits to skip"),
    ref: Optional[str] = Query(
        None, description="Branch, tag, or commit to read history from"
    ),
) -> list[dict]:
    """Get paginated git commit history for a project.

    Parameters
    ----------
    limit:
        Maximum number of commits to return.
    offset:
        Number of commits to skip from the newest commit.
    ref:
        Optional branch, tag, or commit to read history from.
    """
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
        ttl=FULL_HISTORY_REPO_TTL,
    )
    history = get_commit_history(repo, max_count=limit + offset, ref=ref)
    return history[offset : offset + limit]


@router.get("/projects/{owner_name}/{project_name}/git/commits/{commit_hash}")
def get_project_commit(
    owner_name: str,
    project_name: str,
    commit_hash: str,
    session: SessionDep,
    current_user: CurrentUserOptional,
) -> dict:
    """Get details for a specific commit including changed files.

    Parameters
    ----------
    commit_hash:
        Full or short commit hash to inspect.
    """
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
        ttl=FULL_HISTORY_REPO_TTL,
    )
    try:
        commit = repo.commit(commit_hash)
    except Exception:
        raise HTTPException(404, "Commit not found")
    # Cap response size so a single giant commit (e.g., a large generated
    # file or a wide merge) can't balloon memory or the JSON payload.
    MAX_FILES = 500
    MAX_PATCH_BYTES = 100_000
    changed_files: list[dict] = []
    files_truncated = False
    if commit.parents:
        parent = commit.parents[0]
        diff = parent.diff(commit, create_patch=True)
        for d in diff:
            if len(changed_files) >= MAX_FILES:
                files_truncated = True
                break
            change_type = d.change_type  # A, D, M, R, etc.
            patch_bytes = d.diff if d.diff else b""
            if not isinstance(patch_bytes, bytes):
                patch_bytes = str(patch_bytes).encode(
                    "utf-8", errors="replace"
                )
            # Binary files: skip decoding the patch entirely.
            is_binary = b"\x00" in patch_bytes[:8192]
            patch_truncated = False
            if is_binary:
                patch = None
            else:
                if len(patch_bytes) > MAX_PATCH_BYTES:
                    patch_bytes = patch_bytes[:MAX_PATCH_BYTES]
                    patch_truncated = True
                patch = patch_bytes.decode("utf-8", errors="replace")
            if patch is None:
                insertions = None
                deletions = None
            else:
                insertions = sum(
                    1
                    for line in patch.splitlines()
                    if line.startswith("+") and not line.startswith("+++")
                )
                deletions = sum(
                    1
                    for line in patch.splitlines()
                    if line.startswith("-") and not line.startswith("---")
                )
            changed_files.append(
                {
                    "path": d.b_path or d.a_path,
                    "old_path": d.a_path if change_type == "R" else None,
                    "change_type": change_type,
                    "insertions": insertions,
                    "deletions": deletions,
                    "patch": patch,
                    "is_binary": is_binary,
                    "patch_truncated": patch_truncated,
                }
            )
    else:
        # Initial commit--list all files
        for item in commit.tree.traverse():
            if len(changed_files) >= MAX_FILES:
                files_truncated = True
                break
            if item.type == "blob":  # type: ignore[union-attr]
                changed_files.append(
                    {
                        "path": item.path,  # type: ignore[union-attr]
                        "old_path": None,
                        "change_type": "A",
                        "insertions": None,
                        "deletions": None,
                        "patch": None,
                        "is_binary": False,
                        "patch_truncated": False,
                    }
                )
    message = (
        commit.message
        if isinstance(commit.message, str)
        else bytes(commit.message).decode("utf-8", errors="replace")
    )
    return {
        "hash": commit.hexsha,
        "short_hash": commit.hexsha[:7],
        "message": message,
        "summary": message.split("\n")[0],
        "author": commit.author.name,
        "author_email": commit.author.email,
        "timestamp": commit.committed_datetime.isoformat(),
        "parent_hashes": [p.hexsha[:7] for p in commit.parents],
        "changed_files": changed_files,
        "files_truncated": files_truncated,
    }


@router.get("/projects/{owner_name}/{project_name}/git/file-history")
def get_project_file_history(
    owner_name: str,
    project_name: str,
    path: str,
    session: SessionDep,
    current_user: CurrentUserOptional,
    limit: int = Query(
        100, le=200, description="Max number of commits to return"
    ),
    storage: Optional[Literal["git", "dvc", "dvc-zip"]] = Query(
        None,
        description=(
            "Artifact storage class; when supplied, limits the lookup to "
            "relevant sources (e.g., skips the dvc.lock scan for git files)."
        ),
    ),
) -> list[dict]:
    """Get git commit history for a specific file path.

    Returns commits that touched the file directly, its DVC pointer (.dvc),
    or dvc.lock (for pipeline outputs), so DVC-tracked artifacts are covered.
    Pass ``storage`` when the caller knows the artifact's storage class so
    irrelevant lookups are skipped.
    """
    # Prevent path traversal
    if os.path.isabs(path):
        raise HTTPException(400, "Absolute paths are not allowed")
    if ".." in path.split(os.sep):
        raise HTTPException(400, "Path traversal is not allowed")
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
        ttl=FULL_HISTORY_REPO_TTL,
    )
    return get_file_history(repo, path=path, max_count=limit, storage=storage)


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
    ref: str | None = None,
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
    params = {"ref": ref} if ref is not None else None
    resp = requests.get(url, headers=headers, params=params)
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
    ref: str | None = None,
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
        project=project,
        user=current_user,
        session=session,
        ttl=ttl,
        ref=ref,
    )
    return app.projects.get_contents_from_repo(
        project=project,
        repo=repo,
        path=path,
        ref=ref,
    )


@router.get("/projects/{owner_name}/{project_name}/contents-paths")
def get_project_content_paths(
    owner_name: str,
    project_name: str,
    session: SessionDep,
    current_user: CurrentUserOptional,
    ref: str | None = None,
    ttl: int | None = DEFAULT_REPO_TTL,
) -> list[str]:
    """Flat list of all selectable file paths in the project.

    Powers fuzzy path search (e.g., the release path picker) without walking the
    tree one directory at a time. Includes Git-tracked files and DVC-tracked
    outputs, preferring an output's real path over its ``.dvc`` pointer file.
    """
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=ttl, ref=ref
    )
    tree = app.projects.get_repo_tree_for_ref(repo, ref)
    dvc_lock_outs = app.projects.get_ck_info_and_dvc_outs_from_tree(
        project=project, tree=tree
    ).dvc_lock_outs
    dvc_files = {
        p for p, obj in dvc_lock_outs.items() if obj.get("type") != "dir"
    }
    paths = set(dvc_files)
    for f in repo.git.ls_files().split("\n"):
        if not f or f.startswith(".dvc/"):
            continue
        # Prefer a DVC output's real path over its tracked ``.dvc`` pointer.
        if f.endswith(".dvc") and f[:-4] in dvc_files:
            continue
        paths.add(f)
    return sorted(paths)


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
    message: Annotated[str | None, Form()] = None,
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
        commit_message = message or f"Upload {path} from web"
        repo.git.commit(["-m", commit_message])
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


def _extract_question_text(question: str | dict) -> str:
    """Extract the question text from a calkit.yaml question entry.

    A question may be a plain string or an object with a ``question`` field.
    Any other/unexpected type (e.g. a list) yields an empty string rather than
    a coerced repr, so a non-string never reaches the DB model's ``question``
    field (and the empty text signals to the user that something is off).
    """
    if isinstance(question, dict):
        value = question.get("question", "")
    else:
        value = question
    return value if isinstance(value, str) else ""


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
        existing.question = _extract_question_text(questions.pop(0))
        existing.number = n + 1  # Should already be done, but just in case
    start_number = len(existing_questions) + 1
    logger.info(f"Adding {len(questions)} new questions to DB")
    for n, new in enumerate(questions):
        number = start_number + n
        logger.info(f"Appending new question with number: {number}")
        project.questions.append(
            Question(
                project_id=project.id,
                number=number,
                question=_extract_question_text(new),
            )
        )
    # Delete extra questions in DB
    while len(project.questions) > len(questions_ck):
        q = project.questions.pop(-1)
        logger.info(f"Deleting question number {q.number}")
        session.delete(q)
    session.commit()
    session.refresh(project)
    return project


def _resolve_result_value(
    project: Project,
    repo: git.Repo,
    ref: str | None,
    path: str,
    key: str,
    cache: dict[str, dict | None],
) -> str | None:
    """Read a result file and return the value at ``key`` as a string.

    Supports JSON and YAML result files and dot-separated nested keys (e.g.
    ``metrics.mean``). ``cache`` memoizes parsed files across evidence items.
    Returns None if the file or key cannot be resolved.
    """
    if path not in cache:
        data: dict | None = None
        try:
            item = app.projects.get_contents_from_repo(
                project=project, repo=repo, path=path, ref=ref
            )
            if item.content is not None:
                text = base64.b64decode(item.content).decode("utf-8")
                lower = path.lower()
                if lower.endswith(".json"):
                    data = json.loads(text)
                elif lower.endswith((".yaml", ".yml")):
                    data = ryaml.load(text)
        except Exception as e:
            logger.warning(f"Failed to read result {path}: {e}")
        cache[path] = data if isinstance(data, dict) else None
    data = cache[path]
    if data is None:
        return None
    value: object = data
    for part in key.split("."):
        if isinstance(value, dict) and part in value:
            value = value[part]
        else:
            return None
    if isinstance(value, (dict, list)):
        return None
    return str(value)


def _build_question_evidence(
    project: Project,
    repo: git.Repo,
    ref: str | None,
    evidence_ck: list,
    figures_by_path: dict[str, Figure],
    results_by_path: dict[str, Result],
    publications_by_path: dict[str, Publication],
    result_value_cache: dict[str, dict | None],
) -> list[QuestionEvidence]:
    """Turn calkit.yaml evidence entries into resolved QuestionEvidence."""
    evidence = []
    for ev in evidence_ck:
        if not isinstance(ev, dict) or ev.get("kind") not in (
            "figure",
            "result",
            "publication",
        ):
            continue
        path = ev.get("path", "")
        item = QuestionEvidence(
            kind=ev["kind"],
            path=path,
            key=ev.get("key"),
            explanation=ev.get("explanation"),
        )
        if item.kind == "figure":
            item.figure = figures_by_path.get(path)
        elif item.kind == "publication":
            item.publication = publications_by_path.get(path)
        else:
            item.result = results_by_path.get(path)
            if item.key:
                item.value = _resolve_result_value(
                    project=project,
                    repo=repo,
                    ref=ref,
                    path=path,
                    key=item.key,
                    cache=result_value_cache,
                )
        evidence.append(item)
    return evidence


def _build_questions_public(
    project: Project,
    repo: git.Repo,
    session: Session,
    ref: str | None,
    ck_info: dict,
) -> list[QuestionPublic]:
    """Merge synced DB questions (for id/number) with the richer calkit.yaml
    question objects, resolving any figure/result evidence.
    """
    questions_ck = ck_info.get("questions", [])

    def _evidence_of(q: str | dict) -> list:
        return q.get("evidence") or [] if isinstance(q, dict) else []

    kinds = {
        ev.get("kind")
        for q in questions_ck
        for ev in _evidence_of(q)
        if isinstance(ev, dict)
    }
    figures_by_path: dict[str, Figure] = {}
    if "figure" in kinds:
        figures_by_path = {
            fig.path: fig
            for fig in _build_figures(
                project=project, repo=repo, session=session, ref=ref
            )
        }
    results_by_path: dict[str, Result] = {}
    if "result" in kinds:
        results_by_path = {
            res.path: res
            for res in _build_results(project=project, repo=repo, ref=ref)
        }
    publications_by_path: dict[str, Publication] = {}
    if "publication" in kinds:
        publications_by_path = {
            pub.path: pub
            for pub in _build_publications(project=project, repo=repo, ref=ref)
        }
    db_questions = sorted(project.questions, key=lambda q: q.number)
    result_value_cache: dict[str, dict | None] = {}
    questions_public = []
    for q_ck, q_db in zip(questions_ck, db_questions):
        hypothesis = q_ck.get("hypothesis") if isinstance(q_ck, dict) else None
        answer = q_ck.get("answer") if isinstance(q_ck, dict) else None
        evidence = _build_question_evidence(
            project=project,
            repo=repo,
            ref=ref,
            evidence_ck=_evidence_of(q_ck),
            figures_by_path=figures_by_path,
            results_by_path=results_by_path,
            publications_by_path=publications_by_path,
            result_value_cache=result_value_cache,
        )
        questions_public.append(
            QuestionPublic(
                id=q_db.id,
                project_id=q_db.project_id,
                number=q_db.number,
                question=q_db.question,
                hypothesis=hypothesis,
                answer=answer,
                evidence=evidence,
            )
        )
    return questions_public


@router.get("/projects/{owner_name}/{project_name}/questions")
def get_project_questions(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ref: str | None = None,
) -> list[QuestionPublic]:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="read",
    )
    # Read at the requested ref. get_ck_info reads the working tree, which
    # get_repo never checks out to the ref, so it would return the default
    # branch's questions instead.
    repo = get_repo(
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
        ref=ref,
    )
    ck_info = app.projects.get_ck_info_for_ref(
        project=project, repo=repo, ref=ref
    )
    project = _sync_questions_with_db(
        ck_info=ck_info, project=project, session=session
    )
    # TODO: Maybe questions don't belong in the Calkit file?
    return _build_questions_public(
        project=project,
        repo=repo,
        session=session,
        ref=ref,
        ck_info=ck_info,
    )


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
    ck_info = app.projects.get_ck_info_from_repo(
        repo=repo,
        process_includes=True,
    )
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


def _apply_question_update(
    existing: str | dict, req: "QuestionPut"
) -> str | dict:
    """Apply a QuestionPut to a calkit.yaml question entry.

    Normalizes the entry to object form, sets provided fields (dropping an
    empty hypothesis/answer/evidence so calkit.yaml stays clean), and collapses
    back to a bare string when only the question text remains.
    """
    if isinstance(existing, str):
        question: dict = {"question": existing}
    elif isinstance(existing, dict):
        question = dict(existing)
    else:
        raise HTTPException(422, "Invalid question entry")
    if req.question:
        question["question"] = req.question
    if req.hypothesis:
        question["hypothesis"] = req.hypothesis
    else:
        question.pop("hypothesis", None)
    if req.answer:
        question["answer"] = req.answer
    else:
        question.pop("answer", None)
    evidence = []
    for ev in req.evidence:
        entry: dict = {"kind": ev.kind, "path": ev.path}
        if ev.kind == "result" and ev.key:
            entry["key"] = ev.key
        if ev.explanation:
            entry["explanation"] = ev.explanation
        evidence.append(entry)
    if evidence:
        question["evidence"] = evidence
    else:
        question.pop("evidence", None)
    # Collapse back to a bare string if nothing but the question text remains.
    if set(question.keys()) == {"question"}:
        return question["question"]
    return question


@router.put("/projects/{owner_name}/{project_name}/questions/{number}")
def put_project_question(
    owner_name: str,
    project_name: str,
    number: int,
    req: QuestionPut,
    current_user: CurrentUser,
    session: SessionDep,
) -> QuestionPublic:
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
    ck_info = app.projects.get_ck_info_from_repo(
        repo=repo,
        process_includes=True,
    )
    ck_questions = ck_info.get("questions", [])
    if number < 1 or number > len(ck_questions):
        raise HTTPException(404, "Question not found")
    idx = number - 1
    ck_questions[idx] = _apply_question_update(ck_questions[idx], req)
    ck_info["questions"] = ck_questions
    with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    if repo.is_dirty():
        repo.git.commit(["-m", f"Update question {number}"])
        repo.git.push(["origin", repo.active_branch.name])
    project = _sync_questions_with_db(
        ck_info=ck_info, project=project, session=session
    )
    return _build_questions_public(
        project=project,
        repo=repo,
        session=session,
        ref=None,
        ck_info=ck_info,
    )[idx]


def _build_figures(
    project: Project,
    repo: git.Repo,
    session: Session,
    ref: str | None,
) -> list[Figure]:
    """Build the list of project figures, declared and auto-detected, with
    content resolved for each.
    """
    ck_info = app.projects.get_ck_info_for_ref(
        project=project,
        repo=repo,
        ref=ref,
    )
    figures = ck_info.get("figures", [])
    # Declared figures (from calkit.yaml) may omit a title; fill one in so
    # they validate against the Figure model.
    for fig in figures:
        if not fig.get("title"):
            fig["title"] = _title_from_path(fig["path"])
    declared_paths = {fig["path"] for fig in figures}

    def _maybe_add_figure(path: str) -> None:
        """Add `path` to figures if it looks like a figure and is not yet
        known.
        """
        parts = path.split("/")
        if any(p.startswith(".") for p in parts):
            return
        ext = "." + parts[-1].rsplit(".", 1)[-1] if "." in parts[-1] else ""
        dir_parts = [p.lower() for p in parts[:-1]]
        if ext.lower() in FIGURE_EXTS and any(
            d in FIGURE_DIRS for d in dir_parts
        ):
            if path not in declared_paths:
                figures.append({"path": path, "title": _title_from_path(path)})
                declared_paths.add(path)

    # Auto-detect figures from the repo tree
    try:
        commit = repo.commit(ref) if ref else repo.head.commit
        for blob in commit.tree.traverse():
            if blob.type != "blob":  # type: ignore[union-attr]
                continue
            blob_path: str = blob.path  # type: ignore[union-attr]
            _maybe_add_figure(blob_path)
            # Also detect figures stored via standalone .dvc pointer files
            # (tracked with `dvc add`, not via a DVC pipeline stage).
            if blob_path.endswith(".dvc"):
                try:
                    dvc_data = yaml.safe_load(blob.data_stream.read())  # type: ignore[union-attr]
                    outs = (
                        dvc_data.get("outs")
                        if isinstance(dvc_data, dict)
                        else None
                    )
                    out = outs[0] if isinstance(outs, list) and outs else None
                    out_path = (
                        out.get("path") if isinstance(out, dict) else None
                    )
                    if isinstance(out_path, str) and out_path:
                        actual_path = os.path.normpath(
                            os.path.join(os.path.dirname(blob_path), out_path)
                        )
                    else:
                        actual_path = blob_path[:-4]
                    if actual_path:
                        _maybe_add_figure(actual_path)
                except Exception:
                    actual_path = blob_path[:-4]
                    if actual_path:
                        _maybe_add_figure(actual_path)
    except Exception:
        pass
    # Pre-compute calkit.yaml / dvc.lock metadata once for the tree so we
    # don't re-read and re-expand on every iteration.
    tree = app.projects.get_repo_tree_for_ref(repo, ref)
    (
        ck_info_full,
        dvc_lock_outs,
        zip_path_map,
        _,
    ) = app.projects.get_ck_info_and_dvc_outs_from_tree(project, tree)
    # Also auto-detect figures from DVC lock outs (files stored with DVC)
    for dvc_path, dvc_out in dvc_lock_outs.items():
        if dvc_out.get("type") == "dir":
            continue
        _maybe_add_figure(dvc_path)
    if not figures:
        return []
    # Build comment count map from DB
    comment_counts = dict(
        session.exec(
            select(ProjectComment.artifact_path, func.count())
            .where(
                ProjectComment.project_id == project.id,
                ProjectComment.artifact_type == "figure",
                ProjectComment.parent_id == None,  # noqa: E711
                ProjectComment.resolved == None,  # noqa: E711
            )
            .group_by(ProjectComment.artifact_path)
        ).all()
    )
    # Get the figure content and base64 encode it.
    # Staleness is best-effort: never let it block the figure listing.
    dvc_lock: dict = {}
    stage_statuses = {}
    try:
        if tree.is_file("dvc.lock"):
            dvc_lock = ryaml.load(tree.read_bytes("dvc.lock").decode()) or {}
        dvc_yaml: dict = {}
        if tree.is_file("dvc.yaml"):
            dvc_yaml = ryaml.load(tree.read_bytes("dvc.yaml").decode()) or {}
        stage_statuses = compute_stage_statuses(
            dvc_yaml=dvc_yaml,
            dvc_lock=dvc_lock,
            tree=tree,
            owner_name=project.owner_account_name,
            project_name=project.name,
            fs=get_object_fs(),
            cache_token=resolve_commit_sha(repo, ref),
        )
    except Exception as e:
        logger.warning(f"Failed to compute pipeline status for figures: {e}")
    for fig in figures:
        item = app.projects.get_contents_from_tree(
            project=project,
            tree=tree,
            path=fig["path"],
            ck_info=ck_info_full,
            dvc_lock_outs=dvc_lock_outs,
            zip_path_map=zip_path_map,
        )
        fig["content"] = item.content
        fig["url"] = item.url
        fig["comment_count"] = comment_counts.get(fig["path"], 0)
        if not fig.get("stage"):
            auto_stage = find_stage_for_path(fig["path"], dvc_lock)
            if auto_stage is not None:
                fig["stage"] = auto_stage
        if fig.get("stage") and fig["stage"] in stage_statuses:
            fig["stage_status"] = stage_statuses[fig["stage"]].model_dump()
        fig["storage"] = item.storage
    return [Figure.model_validate(fig) for fig in figures]


@router.get("/projects/{owner_name}/{project_name}/figures")
def get_project_figures(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ref: str | None = None,
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
        ref=ref,
    )
    return _build_figures(project=project, repo=repo, session=session, ref=ref)


def _build_results(
    project: Project,
    repo: git.Repo,
    ref: str | None,
) -> list[Result]:
    """Build the list of project results, declared and auto-detected.

    Mirrors figure auto-detection: data-like files under a results-style
    directory that aren't already figures. Results carry no base64 content.
    """
    ck_info = app.projects.get_ck_info_for_ref(
        project=project,
        repo=repo,
        ref=ref,
    )
    results = ck_info.get("results", [])
    for res in results:
        if not res.get("title"):
            res["title"] = _title_from_path(res["path"])
    declared_paths = {res["path"] for res in results}

    def _is_result_path(path: str) -> bool:
        parts = path.split("/")
        if any(p.startswith(".") for p in parts):
            return False
        name = PurePosixPath(path)
        ext = name.suffix.lower()
        dir_parts = [p.lower() for p in parts[:-1]]
        if ext not in RESULT_EXTS:
            return False
        is_figure = ext in FIGURE_EXTS and any(
            d in FIGURE_DIRS for d in dir_parts
        )
        if is_figure:
            return False
        # A data-like file under a results-style directory, or one named
        # ``results.<ext>`` anywhere (e.g. a top-level ``results.json``).
        return (
            any(d in RESULT_DIRS for d in dir_parts) or name.stem == "results"
        )

    def _maybe_add_result(path: str) -> None:
        if path not in declared_paths and _is_result_path(path):
            results.append({"path": path, "title": _title_from_path(path)})
            declared_paths.add(path)

    # Auto-detect results from the repo tree
    try:
        commit = repo.commit(ref) if ref else repo.head.commit
        for blob in commit.tree.traverse():
            if blob.type != "blob":  # type: ignore[union-attr]
                continue
            _maybe_add_result(blob.path)  # type: ignore[union-attr]
    except Exception:
        pass
    # Also auto-detect results from DVC lock outs (files stored with DVC)
    tree = app.projects.get_repo_tree_for_ref(repo, ref)
    dvc_lock_outs = app.projects.get_ck_info_and_dvc_outs_from_tree(
        project, tree
    ).dvc_lock_outs
    for dvc_path, dvc_out in dvc_lock_outs.items():
        if dvc_out.get("type") == "dir":
            continue
        _maybe_add_result(dvc_path)
    return [Result.model_validate(res) for res in results]


def _build_publications(
    project: Project,
    repo: git.Repo,
    ref: str | None,
) -> list[Publication]:
    """Build the list of declared project publications (path/title/type),
    without base64 content, for resolving question evidence.
    """
    ck_info = app.projects.get_ck_info_for_ref(
        project=project,
        repo=repo,
        ref=ref,
    )
    publications = ck_info.get("publications", [])
    for pub in publications:
        if not pub.get("title"):
            pub["title"] = _title_from_path(pub["path"])
    return [Publication.model_validate(pub) for pub in publications]


@router.get("/projects/{owner_name}/{project_name}/results")
def get_project_results(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ref: str | None = None,
) -> list[Result]:
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
        ref=ref,
    )
    return _build_results(project=project, repo=repo, ref=ref)


@router.get("/projects/{owner_name}/{project_name}/figures/{figure_path}")
def get_project_figure(
    owner_name: str,
    project_name: str,
    figure_path: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ttl: int | None = DEFAULT_REPO_TTL,
    ref: str | None = None,
) -> Figure:
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
        ttl=ttl,
        ref=ref,
    )
    return app.projects.get_figure_from_repo(
        project=project,
        repo=repo,
        path=figure_path,
        ref=ref,
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
    file_data: bytes | None = None
    full_fig_path: str | None = None
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
            subprocess.call(
                [sys.executable, "-m", "dvc", "init"], cwd=repo.working_dir
            )
        logger.info(f"Running dvc add {path}")
        subprocess.check_call(
            [sys.executable, "-m", "dvc", "add", path],
            cwd=repo.working_dir,
        )
        files_to_stage = [path + ".dvc"]
        gitignore = os.path.join(os.path.dirname(path), ".gitignore")
        if os.path.isfile(os.path.join(repo.working_dir, gitignore)):
            files_to_stage.append(gitignore)
        logger.info(f"Git-adding {files_to_stage}")
        repo.git.add(files_to_stage)
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
        if file_data is None or full_fig_path is None:
            raise HTTPException(500, "Figure upload data missing")
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
            f.write(file_data)  # type: ignore[arg-type]
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


class CommentReply(BaseModel):
    body: str


@router.get("/projects/{owner_name}/{project_name}/comments")
def get_project_comments(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    artifact_type: str | None = None,
    artifact_path: str | None = None,
) -> list[ProjectComment]:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    query = select(ProjectComment).where(
        ProjectComment.project_id == project.id
    )
    if artifact_type is not None:
        query = query.where(ProjectComment.artifact_type == artifact_type)
    if artifact_path is not None:
        query = query.where(ProjectComment.artifact_path == artifact_path)
    comments = list(session.exec(query).all())
    _sync_github_issue_resolutions(session, comments, current_user)
    return comments


def _make_comment_artifact_link(
    owner_name: str,
    project_name: str,
    artifact_type: str | None,
    artifact_path: str,
) -> str:
    """Frontend-relative deep link to the artifact a comment is about.

    Releases live at a path segment (``/releases/{name}``); other artifacts use
    a ``?path=`` query on their section page.
    """
    base = f"/{owner_name}/{project_name}"
    # Encode so paths/names with spaces, #, ?, /, etc. don't break the link.
    encoded = quote(artifact_path, safe="")
    if artifact_type == "release":
        return f"{base}/releases/{encoded}"
    route_map = {
        "figure": "figures",
        "publication": "publications",
        "presentation": "presentations",
        "notebook": "notebooks",
        "file": "files",
    }
    route = route_map.get(artifact_type or "", "files")
    return f"{base}/{route}?path={encoded}"


@router.post("/projects/{owner_name}/{project_name}/comments")
def post_project_comment(
    owner_name: str,
    project_name: str,
    comment_in: ProjectCommentPost,
    current_user: CurrentUser,
    session: SessionDep,
) -> ProjectComment:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    repo = get_repo(
        project=project,
        user=current_user,
        session=session,
        ttl=DEFAULT_REPO_TTL,
    )
    # For figure comments, verify the path exists in the repo
    if comment_in.artifact_type == "figure" and comment_in.artifact_path:
        ck_info = get_ck_info_from_repo(repo)
        fig_paths = {fig["path"] for fig in ck_info.get("figures", [])}
        if comment_in.artifact_path not in fig_paths:
            try:
                repo.head.commit.tree[comment_in.artifact_path]
            except KeyError:
                raise HTTPException(404)
    # Resolve the commit hash for the git context at comment time
    try:
        if comment_in.git_ref:
            git_rev = repo.commit(comment_in.git_ref).hexsha
        else:
            git_rev = repo.head.commit.hexsha
    except Exception:
        logger.info(
            f"Failed to resolve Git ref {comment_in.git_ref} for comment; "
            "storing without Git rev"
        )
        git_rev = None
    comment = ProjectComment(
        project_id=project.id,
        artifact_path=comment_in.artifact_path,
        artifact_type=comment_in.artifact_type,
        comment=comment_in.comment,
        highlight=comment_in.highlight.model_dump()
        if comment_in.highlight
        else None,
        user_id=current_user.id,
        parent_id=comment_in.parent_id,
        git_ref=comment_in.git_ref,
        git_rev=git_rev,
    )
    session.add(comment)
    session.flush()
    if comment_in.create_github_issue and comment_in.artifact_path:
        app_base = settings.frontend_host.rstrip("/")
        artifact_link = app_base + _make_comment_artifact_link(
            owner_name,
            project_name,
            comment_in.artifact_type,
            comment_in.artifact_path,
        )
        body_lines = [
            f"Comment on [{comment_in.artifact_path}]({artifact_link}):",
            "",
            comment_in.comment,
        ]
        if comment_in.highlight:
            highlighted_text = comment_in.highlight.content.get("text", "")
            if highlighted_text:
                body_lines += ["", f"> {highlighted_text}"]
        issue_url = _try_create_github_issue(
            session=session,
            current_user=current_user,
            project=project,
            title=_make_comment_title(comment_in.comment),
            body="\n".join(body_lines),
        )
        if issue_url:
            comment.external_url = issue_url
    commenter_name = current_user.full_name or current_user.account.github_name
    if comment_in.artifact_path:
        _fan_out_notifications(
            session=session,
            project=project,
            commenter_id=current_user.id,
            message=f"{commenter_name} commented on {comment_in.artifact_path}",
            link=_make_comment_artifact_link(
                owner_name,
                project_name,
                comment_in.artifact_type,
                comment_in.artifact_path,
            ),
        )
    session.commit()
    session.refresh(comment)
    mixpanel.track(
        current_user,
        "Posted project comment",
        {
            "owner_name": owner_name,
            "project_name": project_name,
            "artifact_type": comment_in.artifact_type,
            "has_highlight": bool(comment_in.highlight),
        },
    )
    return comment


@router.patch("/projects/{owner_name}/{project_name}/comments/{comment_id}")
def patch_project_comment(
    owner_name: str,
    project_name: str,
    comment_id: uuid.UUID,
    patch: ProjectCommentPatch,
    current_user: CurrentUser,
    session: SessionDep,
) -> ProjectComment:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    comment = session.get(ProjectComment, comment_id)
    if comment is None or comment.project_id != project.id:
        raise HTTPException(404)
    now = utcnow() if patch.resolved else None
    comment.resolved = now
    session.add(comment)
    # Cascade resolve/unresolve to all descendants
    queue = [comment_id]
    while queue:
        parent_id = queue.pop()
        children = session.exec(
            select(ProjectComment).where(ProjectComment.parent_id == parent_id)
        ).all()
        for child in children:
            child.resolved = now
            session.add(child)
            if child.id:
                queue.append(child.id)
    session.commit()
    session.refresh(comment)
    if patch.resolved:
        _try_close_github_issue(session, current_user, comment.external_url)
    else:
        _try_reopen_github_issue(session, current_user, comment.external_url)
    mixpanel.user_resolved_comment(
        current_user,
        owner_name,
        project_name,
        comment.artifact_type or "project",
        patch.resolved,
    )
    return comment


@router.delete("/projects/{owner_name}/{project_name}/comments/{comment_id}")
def delete_project_comment(
    owner_name: str,
    project_name: str,
    comment_id: uuid.UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> None:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    comment = session.get(ProjectComment, comment_id)
    if comment is None or comment.project_id != project.id:
        raise HTTPException(404)
    if comment.user_id != current_user.id:
        raise HTTPException(403)
    session.delete(comment)
    session.commit()


@router.post(
    "/projects/{owner_name}/{project_name}/comments/{comment_id}/replies"
)
def post_project_comment_reply(
    owner_name: str,
    project_name: str,
    comment_id: uuid.UUID,
    reply: CommentReply,
    current_user: CurrentUser,
    session: SessionDep,
) -> ProjectComment:
    # Requires write (like posting a top-level comment): a reply can be
    # mirrored to the project's GitHub issue via the App installation token, so
    # a read-only collaborator must not be able to trigger it.
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    comment = session.get(ProjectComment, comment_id)
    if comment is None or comment.project_id != project.id:
        raise HTTPException(404)
    # Enforce one-level threading: if the target comment is itself a reply,
    # attach the new reply to its parent so the thread stays flat.
    thread_root_id = comment.parent_id if comment.parent_id else comment_id
    thread_root = (
        session.get(ProjectComment, thread_root_id)
        if thread_root_id != comment_id
        else comment
    )
    if thread_root and thread_root.external_url:
        _try_post_github_issue_comment(
            session, current_user, thread_root.external_url, reply.body
        )
    elif comment.external_url:
        _try_post_github_issue_comment(
            session, current_user, comment.external_url, reply.body
        )
    reply_comment = ProjectComment(
        project_id=project.id,
        artifact_path=comment.artifact_path,
        artifact_type=comment.artifact_type,
        comment=reply.body,
        user_id=current_user.id,
        parent_id=thread_root_id,
    )
    session.add(reply_comment)
    session.commit()
    session.refresh(reply_comment)
    return reply_comment


def _github_token_for_repo(
    session: Session,
    current_user: User,
    owner_repo: str,
) -> str | None:
    """Return a token for GitHub API calls on ``owner/repo``.

    Prefers the user's personal token; for GitHub-less collaborators (e.g.
    invite-link members) falls back to the Calkit GitHub App installation
    token so they can still open, close, and comment on issues. Returns None
    if neither is available.
    """
    try:
        return users.get_github_token(session, current_user)
    except HTTPException:
        pass
    try:
        owner_name, repo_name = owner_repo.split("/", 1)
        return github.get_app_installation_token(owner_name, repo_name)
    except (github.GitHubAppNotConfigured, HTTPException) as e:
        logger.info(
            f"No GitHub token for {current_user.email} on {owner_repo}: {e}"
        )
        return None


def _make_github_authorship_prefix(user: User) -> str:
    """A one-line attribution to prepend to issues/comments a GitHub-less user
    posts through the Calkit App.

    GitHub users author under their own GitHub account, so the content already
    shows who wrote it; GitHub-less users post via the App (authored as the
    bot), so name them in the body. Returns "" for GitHub users.
    """
    if user.account.github_name is not None:
        return ""
    name = user.full_name or user.account.name
    return f"_Posted by {name} ({user.email}) via Calkit._\n\n"


def _sync_github_issue_resolutions(
    session: Session,
    comments: list[ProjectComment],
    current_user: CurrentUserOptional,
) -> None:
    """Check GitHub issue status for unresolved comments with an external_url.

    If the linked issue is closed, mark the comment resolved. Silently ignores
    any errors (rate limits, missing token, unexpected URL shape, etc.) so this
    never breaks a read request.
    """
    unresolved_with_url = [
        c for c in comments if c.external_url and c.resolved is None
    ]
    if not unresolved_with_url:
        return
    changed = False
    # Resolve a token per repo (personal token, else App install token for
    # GitHub-less users), cached so we don't re-mint per comment. Falls back to
    # unauthenticated (60 req/hr) for public repos when neither is available.
    token_by_repo: dict[str, str | None] = {}
    for comment in unresolved_with_url:
        url = str(comment.external_url)
        # Parse owner/repo/number from
        # https://github.com/{owner}/{repo}/issues/{n}
        try:
            parts = url.rstrip("/").split("/")
            issue_number = int(parts[-1])
            repo = f"{parts[-4]}/{parts[-3]}"
        except Exception:
            continue
        if repo not in token_by_repo:
            token_by_repo[repo] = (
                _github_token_for_repo(session, current_user, repo)
                if current_user is not None
                else None
            )
        headers = {"Accept": "application/vnd.github+json"}
        token = token_by_repo[repo]
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            resp = requests.get(
                f"https://api.github.com/repos/{repo}/issues/{issue_number}",
                headers=headers,
                timeout=5,
            )
            if (
                resp.status_code == 200
                and resp.json().get("state") == "closed"
            ):
                comment.resolved = utcnow()
                session.add(comment)
                changed = True
        except Exception as exc:
            logger.debug(f"GitHub issue sync failed for {url}: {exc}")
    if changed:
        session.commit()


def _make_comment_title(comment: str) -> str:
    """Extract a GitHub issue title from the first sentence of a comment.

    Strips trailing ``.`` and ``!`` but preserves ``?`` so questions read
    naturally as titles.
    """
    import re

    m = re.search(r"([.!?])\s", comment)
    if m:
        sentence = comment[: m.start() + 1]
    else:
        sentence = comment.split("\n")[0]
    sentence = sentence.rstrip()
    if sentence.endswith(".") or sentence.endswith("!"):
        sentence = sentence[:-1]
    return sentence[:256]


def _try_create_github_issue(
    session: Session,
    current_user: User,
    project: Project,
    title: str,
    body: str,
) -> str | None:
    """Create a GitHub issue on the project repo and return its URL.

    Returns None if the project has no GitHub repo or the user has no token.
    Never raises--failures are logged and silently swallowed so a missing
    token doesn't prevent the comment from being saved.
    """
    github_repo = project.github_repo
    if not github_repo:
        return None
    token = _github_token_for_repo(session, current_user, github_repo)
    if token is None:
        logger.info(
            f"Skipping GitHub issue creation for {current_user.email}: "
            "no GitHub token"
        )
        return None
    resp = requests.post(
        f"https://api.github.com/repos/{github_repo}/issues",
        json={
            "title": title,
            "body": f"{_make_github_authorship_prefix(current_user)}{body}",
        },
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        },
        timeout=10,
    )
    if not resp.ok:
        logger.warning(
            f"GitHub issue creation failed for {github_repo}: "
            f"{resp.status_code} {resp.text}"
        )
        return None
    return resp.json().get("html_url")


def _try_post_github_issue_comment(
    session: Session,
    current_user: User,
    external_url: str,
    body: str,
) -> str | None:
    """Post a comment to the linked GitHub issue. Returns the comment URL or None."""
    try:
        parts = external_url.rstrip("/").split("/")
        issue_number = int(parts[-1])
        repo = f"{parts[-4]}/{parts[-3]}"
    except Exception:
        return None
    token = _github_token_for_repo(session, current_user, repo)
    if token is None:
        logger.debug("Skipping GitHub issue comment: no token")
        return None
    try:
        resp = requests.post(
            f"https://api.github.com/repos/{repo}/issues/{issue_number}/comments",
            json={
                "body": f"{_make_github_authorship_prefix(current_user)}{body}"
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )
        if not resp.ok:
            logger.warning(
                f"GitHub issue comment failed for {external_url}: "
                f"{resp.status_code} {resp.text}"
            )
            return None
        return resp.json().get("html_url")
    except Exception as exc:
        logger.debug(f"GitHub issue comment failed for {external_url}: {exc}")
        return None


def _try_reopen_github_issue(
    session: Session,
    current_user: User,
    external_url: str | None,
) -> None:
    """Reopen the linked GitHub issue if one exists.

    Silently ignores any errors so a missing token or unexpected URL never
    prevents the comment from being unresolved.
    """
    if not external_url:
        return
    try:
        parts = external_url.rstrip("/").split("/")
        issue_number = int(parts[-1])
        repo = f"{parts[-4]}/{parts[-3]}"
    except Exception:
        return
    token = _github_token_for_repo(session, current_user, repo)
    if token is None:
        logger.debug("Skipping GitHub issue reopen: no token")
        return
    try:
        resp = requests.patch(
            f"https://api.github.com/repos/{repo}/issues/{issue_number}",
            json={"state": "open"},
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )
        if not resp.ok:
            logger.warning(
                f"GitHub issue reopen failed for {external_url}: "
                f"{resp.status_code} {resp.text}"
            )
    except Exception as exc:
        logger.debug(f"GitHub issue reopen failed for {external_url}: {exc}")


def _try_close_github_issue(
    session: Session,
    current_user: User,
    external_url: str | None,
) -> None:
    """Close the linked GitHub issue if one exists.

    Silently ignores any errors so a missing token or unexpected URL never
    prevents the comment from being resolved.
    """
    if not external_url:
        return
    try:
        parts = external_url.rstrip("/").split("/")
        issue_number = int(parts[-1])
        repo = f"{parts[-4]}/{parts[-3]}"
    except Exception:
        return
    token = _github_token_for_repo(session, current_user, repo)
    if token is None:
        logger.debug("Skipping GitHub issue close: no token")
        return
    try:
        resp = requests.patch(
            f"https://api.github.com/repos/{repo}/issues/{issue_number}",
            json={"state": "closed"},
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )
        if not resp.ok:
            logger.warning(
                f"GitHub issue close failed for {external_url}: "
                f"{resp.status_code} {resp.text}"
            )
    except Exception as exc:
        logger.debug(f"GitHub issue close failed for {external_url}: {exc}")


def _fan_out_notifications(
    session: Session,
    project: Project,
    commenter_id: uuid.UUID,
    message: str,
    link: str,
) -> None:
    """Create Notification rows for all project members except the commenter."""
    # Collect user IDs: project owner + anyone with explicit access
    recipient_ids: set[uuid.UUID] = set()
    owner_account = session.get(Account, project.owner_account_id)
    if owner_account and owner_account.user_id:
        recipient_ids.add(owner_account.user_id)
    access_rows = session.exec(
        select(UserProjectAccess).where(
            UserProjectAccess.project_id == project.id,
            or_(
                UserProjectAccess.role_id.is_not(None),
                UserProjectAccess.github_access.is_not(None),
            ),
        )
    ).fetchall()
    for row in access_rows:
        recipient_ids.add(row.user_id)
    recipient_ids.discard(commenter_id)
    for uid in recipient_ids:
        session.add(
            Notification(
                user_id=uid,
                project_id=project.id,
                message=message,
                link=link,
            )
        )


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
    ref: str | None = None,
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
        ref=ref,
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
    ref: str | None = None,
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
        ref=ref,
    )
    git_rev = repo.git.rev_parse(["HEAD"])
    repo_dir = repo.working_dir
    ck_info = app.projects.get_ck_info_for_ref(
        project=project,
        repo=repo,
        ref=ref,
    )
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
    ck_info = app.projects.get_ck_info_from_repo(repo=repo)
    datasets = ck_info.get("datasets", [])
    ds_paths = [ds.get("path") for ds in datasets]
    if req.path in ds_paths:
        raise HTTPException(400, "Dataset already exists")
    local_path = os.path.join(repo.working_dir, req.path)
    zip_path_map = get_zip_path_map_from_repo(repo=repo)
    if not req.imported_from and not (
        os.path.isfile(local_path)
        or os.path.isdir(local_path)
        or os.path.isfile(local_path + ".dvc")
        or req.path in zip_path_map
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
    logger.info(f"Running dvc add {path}")
    subprocess.check_call(
        [sys.executable, "-m", "dvc", "add", path],
        cwd=str(repo.working_dir),
    )
    files_to_stage = [path + ".dvc"]
    gitignore = os.path.join(os.path.dirname(path), ".gitignore")
    if os.path.isfile(os.path.join(repo.working_dir, gitignore)):
        files_to_stage.append(gitignore)
    logger.info(f"Git-adding {files_to_stage}")
    repo.git.add(files_to_stage)
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
        f.write(file_data)  # type: ignore[arg-type]
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
        content=None,  # type: ignore
        url=url,
    )


@router.get("/projects/{owner_name}/{project_name}/publications")
def get_project_publications(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ref: str | None = None,
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
        ref=ref,
    )
    # Read declared metadata at the requested ref. get_repo only fetches a
    # ref, it does not check it out, so reading the working tree would return
    # the default branch's publications/pipeline.
    ck_info = app.projects.get_ck_info_for_ref(
        project=project, repo=repo, ref=ref
    )
    pipeline = app.projects.get_dvc_pipeline_for_ref(repo, ref)
    publications = ck_info.get("publications", [])
    overleaf_info = calkit.overleaf.get_sync_info(
        wdir=repo.working_dir, ck_info=ck_info, fix_legacy=False
    )
    resp = []
    tree = app.projects.get_repo_tree_for_ref(repo, ref)
    (
        ck_info_full,
        dvc_lock_outs,
        zip_path_map,
        _,
    ) = app.projects.get_ck_info_and_dvc_outs_from_tree(project, tree)
    # Staleness is best-effort: never let it block the publication listing.
    dvc_lock: dict = {}
    stage_statuses = {}
    try:
        if tree.is_file("dvc.lock"):
            dvc_lock = ryaml.load(tree.read_bytes("dvc.lock").decode()) or {}
        stage_statuses = compute_stage_statuses(
            dvc_yaml=pipeline,
            dvc_lock=dvc_lock,
            tree=tree,
            owner_name=project.owner_account_name,
            project_name=project.name,
            fs=get_object_fs(),
            cache_token=resolve_commit_sha(repo, ref),
        )
    except Exception as e:
        logger.warning(
            f"Failed to compute pipeline status for publications: {e}"
        )
    for pub in publications:
        if not pub.get("stage") and pub.get("path"):
            auto_stage = find_stage_for_path(pub["path"], dvc_lock)
            if auto_stage is not None:
                pub["stage"] = auto_stage
        if pub.get("stage"):
            pub["stage_info"] = pipeline.get("stages", {}).get(pub["stage"])
            if pub["stage"] in stage_statuses:
                pub["stage_status"] = stage_statuses[pub["stage"]].model_dump()
        # See if we can fetch the content for this publication
        if "path" in pub:
            try:
                item = app.projects.get_contents_from_tree(
                    project=project,
                    tree=tree,
                    path=pub["path"],
                    ck_info=ck_info_full,
                    dvc_lock_outs=dvc_lock_outs,
                    zip_path_map=zip_path_map,
                )
                pub["content"] = item.content
                pub["storage"] = item.storage
                # Prioritize URL if already defined
                if "url" not in pub:
                    pub["url"] = item.url
                # Patch in Overleaf info if we have it
                if "overleaf" not in pub:
                    pubdir = Path(os.path.dirname(pub["path"])).as_posix()
                    if pubdir in overleaf_info:
                        pub["overleaf"] = overleaf_info[pubdir] | {
                            "wdir": pubdir
                        }
            except HTTPException as e:
                logger.warning(
                    f"Failed to get publication at path {pub['path']}: {e}"
                )
        resp.append(Publication.model_validate(pub))
    return resp


@router.get("/projects/{owner_name}/{project_name}/presentations")
def get_project_presentations(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ref: str | None = None,
) -> list[Presentation]:
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
        ref=ref,
    )
    # Read declared metadata at the requested ref. get_repo only fetches a
    # ref, it does not check it out, so reading the working tree would return
    # the default branch's presentations/pipeline.
    ck_info = app.projects.get_ck_info_for_ref(
        project=project, repo=repo, ref=ref
    )
    pipeline = app.projects.get_dvc_pipeline_for_ref(repo, ref)
    presentations = ck_info.get("presentations", [])
    # Paths explicitly declared under ``presentations`` in calkit.yaml. These
    # are always respected (like figures/publications): they're never
    # filtered by the auto-detect heuristics or the PDF/source dedup below.
    declared_paths = {p["path"] for p in presentations if "path" in p}
    explicit_paths = set(declared_paths)

    def _maybe_add_presentation(path: str) -> None:
        """Add ``path`` if it looks like a presentation and isn't declared."""
        parts = path.split("/")
        if any(p.startswith(".") for p in parts):
            return
        ext = "." + parts[-1].rsplit(".", 1)[-1] if "." in parts[-1] else ""
        dir_parts = [p.lower() for p in parts[:-1]]
        if ext.lower() in PRESENTATION_EXTS and any(
            d in PRESENTATION_DIRS for d in dir_parts
        ):
            if path not in declared_paths:
                stem = (
                    parts[-1]
                    .rsplit(".", 1)[0]
                    .replace("_", " ")
                    .replace("-", " ")
                    .capitalize()
                )
                presentations.append({"path": path, "title": stem})
                declared_paths.add(path)

    # Auto-detect presentations from the repo tree
    try:
        commit = repo.commit(ref) if ref else repo.head.commit
        for blob in commit.tree.traverse():
            if blob.type != "blob":  # type: ignore[union-attr]
                continue
            blob_path: str = blob.path  # type: ignore[union-attr]
            _maybe_add_presentation(blob_path)
            # Also detect presentations stored via standalone .dvc pointer
            # files (tracked with `dvc add`, not via a DVC pipeline stage).
            if blob_path.endswith(".dvc"):
                try:
                    dvc_data = yaml.safe_load(blob.data_stream.read())  # type: ignore[union-attr]
                    outs = (
                        dvc_data.get("outs")
                        if isinstance(dvc_data, dict)
                        else None
                    )
                    out = outs[0] if isinstance(outs, list) and outs else None
                    out_path = (
                        out.get("path") if isinstance(out, dict) else None
                    )
                    if isinstance(out_path, str) and out_path:
                        actual_path = os.path.normpath(
                            os.path.join(os.path.dirname(blob_path), out_path)
                        )
                    else:
                        actual_path = blob_path[:-4]
                    if actual_path:
                        _maybe_add_presentation(actual_path)
                except Exception:
                    actual_path = blob_path[:-4]
                    if actual_path:
                        _maybe_add_presentation(actual_path)
    except Exception:
        pass
    tree = app.projects.get_repo_tree_for_ref(repo, ref)
    (
        ck_info_full,
        dvc_lock_outs,
        zip_path_map,
        _,
    ) = app.projects.get_ck_info_and_dvc_outs_from_tree(project, tree)
    # Also auto-detect presentations from DVC lock outs
    for dvc_path, dvc_out in dvc_lock_outs.items():
        if dvc_out.get("type") == "dir":
            continue
        _maybe_add_presentation(dvc_path)
    # Deduplicate auto-detected presentations that exist as both a PDF and a
    # source format (e.g. slides.pptx exported to slides.pdf). Keep the PDF,
    # since it renders and annotates natively, and drop the non-PDF sibling
    # sharing the same path stem. Explicitly declared presentations are
    # always kept.
    pdf_stems = {
        os.path.splitext(p["path"])[0].lower()
        for p in presentations
        if p.get("path", "").lower().endswith(".pdf")
    }
    presentations = [
        p
        for p in presentations
        if p.get("path", "") in explicit_paths
        or p.get("path", "").lower().endswith(".pdf")
        or os.path.splitext(p.get("path", ""))[0].lower() not in pdf_stems
    ]

    # Map each pipeline output path to the stage that produces it, so
    # auto-detected presentations (which aren't declared in calkit.yaml with
    # an explicit ``stage``) can still be associated with their pipeline
    # stage. We read both calkit.yaml's ``pipeline.stages`` (authoritative,
    # uses ``outputs``) and the generated dvc.yaml (uses ``outs``), since the
    # latter may be absent or stale. Output entries can be plain strings or
    # dicts ({path: {...}} in dvc.yaml, {path: ..., storage: ...} in
    # calkit.yaml); templated paths (iterate_over) are skipped.
    def _register_outs(stages: dict, key: str, dest: dict[str, str]) -> None:
        for stage_name, stage_def in (stages or {}).items():
            if not isinstance(stage_def, dict):
                continue
            for out in stage_def.get(key, []) or []:
                if isinstance(out, dict):
                    # dvc.yaml: {path: {...}}; calkit.yaml: {path: <str>}
                    out_paths = (
                        [out["path"]]
                        if "path" in out and isinstance(out["path"], str)
                        else list(out.keys())
                    )
                else:
                    out_paths = [out]
                for out_path in out_paths:
                    if not isinstance(out_path, str) or "{" in out_path:
                        continue
                    norm = os.path.normpath(out_path)
                    dest.setdefault(norm, stage_name)

    out_path_to_stage: dict[str, str] = {}
    _register_outs(
        (ck_info.get("pipeline") or {}).get("stages") or {},
        "outputs",
        out_path_to_stage,
    )
    _register_outs(pipeline.get("stages") or {}, "outs", out_path_to_stage)

    resp = []
    for pres in presentations:
        if "stage" not in pres and "path" in pres:
            # Match the path directly, or any ancestor directory (a stage may
            # declare a directory output containing the presentation file).
            norm_path = os.path.normpath(pres["path"])
            stage_name = out_path_to_stage.get(norm_path)
            while stage_name is None and norm_path not in (".", "/", ""):
                norm_path = os.path.dirname(norm_path)
                if not norm_path:
                    break
                stage_name = out_path_to_stage.get(norm_path)
            if stage_name is not None:
                pres["stage"] = stage_name
        if "stage" in pres:
            pres["stage_info"] = pipeline.get("stages", {}).get(pres["stage"])
        if "path" in pres:
            try:
                item = app.projects.get_contents_from_tree(
                    project=project,
                    tree=tree,
                    path=pres["path"],
                    ck_info=ck_info_full,
                    dvc_lock_outs=dvc_lock_outs,
                    zip_path_map=zip_path_map,
                )
                pres["content"] = item.content
                pres["storage"] = item.storage
                if "url" not in pres:
                    pres["url"] = item.url
            except HTTPException as e:
                logger.warning(
                    f"Failed to get presentation at path {pres['path']}: {e}"
                )
        resp.append(Presentation.model_validate(pres))
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
            subprocess.call(
                [sys.executable, "-m", "dvc", "init"], cwd=repo.working_dir
            )
        logger.info(f"Running dvc add {path}")
        subprocess.check_call(
            [sys.executable, "-m", "dvc", "add", path],
            cwd=repo.working_dir,
        )
        files_to_stage = [path + ".dvc"]
        gitignore = os.path.join(os.path.dirname(path), ".gitignore")
        if os.path.isfile(os.path.join(repo.working_dir, gitignore)):
            files_to_stage.append(gitignore)
        logger.info(f"Git-adding {files_to_stage}")
        repo.git.add(files_to_stage)
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
            f.write(file_data)  # type: ignore
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


@router.post("/projects/{owner_name}/{project_name}/publications/overleaf")
async def post_project_overleaf_publication(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    path: Annotated[str, Form()],
    kind: Annotated[
        Literal[
            "journal-article",
            "conference-paper",
            "report",
            "book",
            "masters-thesis",
            "phd-thesis",
            "other",
        ],
        Form(),
    ],
    overleaf_project_url: Optional[Annotated[str, Form()]] = Form(None),
    title: Optional[Annotated[str, Form()]] = Form(None),
    description: Optional[Annotated[str, Form()]] = Form(None),
    target_path: Optional[Annotated[str, Form()]] = Form(None),
    stage_name: Optional[Annotated[str, Form()]] = Form(None),
    environment_name: Optional[Annotated[str, Form()]] = Form(None),
    overleaf_token: Optional[Annotated[str, Form()]] = Form(None),
    auto_build: Optional[Annotated[bool, Form()]] = Form(False),
    file: Optional[Annotated[UploadFile, File()]] = File(None),
) -> Publication:
    """Import a publication from Overleaf into a project.

    Supports two modes:
    1. Import and link via cloning the Overleaf Git repo.
       Requires an Overleaf token and performs sync setup.
    2. Import ZIP via user-provided downloaded archive.
       Skips linkage and sync info; just copies files into repo.

    Accepts multipart/form-data with an optional 'file' field
    (for the ZIP archive).
    """
    # Validate input: require either an Overleaf URL or a ZIP file
    if (
        overleaf_project_url is None or overleaf_project_url.strip() == ""
    ) and file is None:
        raise HTTPException(
            422, "Either Overleaf project URL or ZIP file must be provided"
        )
    # sync_paths and push_paths are always empty for now since we don't expose
    # them in the UI
    sync_paths: list[str] = []
    push_paths: list[str] = []
    # Basic path validation
    if path == ".":
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
    if os.path.exists(os.path.join(repo.working_dir, path)):
        raise HTTPException(400, f"Path '{path}' already exists in the repo")
    # Make sure path is a posix path
    path = Path(path).as_posix()
    # Handle projects that aren't yet Calkit projects
    ck_info = get_ck_info_from_repo(repo)
    publications = ck_info.get("publications", [])
    # Make sure a publication with this path doesn't already exist
    pubpaths = [pub.get("path") for pub in publications]
    if path in pubpaths:
        raise HTTPException(400, "A publication already exists at this path")
    # Make sure we don't already have a stage with the same name
    pipeline = ck_info.get("pipeline", {})
    stages = pipeline.get("stages", {})
    if not stage_name:
        stage_name = f"build-{path.replace('/', '-')}"
    if stage_name and stage_name in stages:
        raise HTTPException(
            400, f"A stage named '{stage_name}' already exists; please provide"
        )
    # Check environment spec, auto-detecting a TeXlive env to use
    envs = ck_info.get("environments", {})
    env_name = environment_name
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
                (
                    f"Environment {env_name} exists, "
                    "but is not a TeXLive Docker environment"
                ),
            )
    if not env_name:
        env_name = "tex"
        n = 1
        while env_name in envs:
            env_name = f"tex-{n}"
            n += 1
        env = {"kind": "docker", "image": "texlive/texlive:latest-full"}
        envs[env_name] = env
        ck_info["environments"] = envs
    # Determine mode: link vs zip
    import_zip_mode = file is not None
    overleaf_repo = None
    if import_zip_mode:
        overleaf_abs_path = os.path.join(repo.working_dir, path)
        logger.info("Importing Overleaf ZIP archive; skipping linkage")
        # Unzip the whole archive into the requested path
        os.makedirs(overleaf_abs_path, exist_ok=True)
        resolved_dest = os.path.realpath(overleaf_abs_path)
        with zipfile.ZipFile(io.BytesIO(await file.read()), "r") as zf:
            for member in zf.namelist():
                member_dest = os.path.realpath(
                    os.path.join(resolved_dest, member)
                )
                if not member_dest.startswith(resolved_dest + os.sep):
                    raise HTTPException(
                        400,
                        f"ZIP entry '{member}' would escape target directory",
                    )
            zf.extractall(overleaf_abs_path)
    elif overleaf_project_url is not None:
        overleaf_project_id = overleaf_project_url.split("/")[-1]
        # Handle token saving and validation for link mode
        if overleaf_token is not None:
            users.save_overleaf_token(
                session=session,
                user=current_user,
                token=overleaf_token,
                expires=None,
            )
        try:
            users.get_overleaf_token(session=session, user=current_user)
        except HTTPException:
            raise HTTPException(400, "No Overleaf token found")
        try:
            overleaf_repo = get_overleaf_repo(
                project=project,
                user=current_user,
                session=session,
                overleaf_project_id=overleaf_project_id,
            )
        except GitCommandError as e:
            logger.error(f"Failed to clone Overleaf repo: {e}")
            raise HTTPException(
                400,
                (
                    "Failed to fetch Overleaf project; check URL, token, "
                    "and that Git integration is enabled on Overleaf"
                ),
            )
        overleaf_abs_path = overleaf_repo.working_dir
    # Detect target path
    if not target_path:
        overleaf_files = os.listdir(overleaf_abs_path)
        for candidate in ["main.tex", "paper.tex", "report.tex"]:
            if candidate in overleaf_files:
                target_path = candidate
                break
    if not target_path:
        raise HTTPException(
            400, "Target path cannot be detected; please specify"
        )
    if not target_path.endswith(".tex"):
        raise HTTPException(400, "Target path must end with '.tex'")
    target_full_path = os.path.join(overleaf_abs_path, target_path)
    if not os.path.isfile(target_full_path):
        raise HTTPException(
            400,
            f"Target path '{target_path}' does not exist in Overleaf project",
        )
    # Detect title
    if not title:
        with open(target_full_path) as f:
            overleaf_target_text = f.read()
        texsoup = TexSoup(overleaf_target_text)
        title = str(texsoup.title.string) if texsoup.title else None
    if not title:
        raise HTTPException(400, "Title cannot be detected; please provide")
    # Build stage inputs
    overleaf_rel_paths = os.listdir(overleaf_abs_path)
    input_rel_paths = set(overleaf_rel_paths + sync_paths + push_paths)
    input_paths: list[str] = []
    for p in input_rel_paths:
        if (
            p == target_path
            or p.startswith(".")
            or p == target_path.removesuffix(".tex") + ".pdf"
        ):
            continue
        project_rel_path = os.path.join(path, p)
        if project_rel_path not in input_paths:
            input_paths.append(project_rel_path)
    stage = {
        "kind": "latex",
        "target_path": os.path.join(path, target_path),
        "environment": env_name,
        "inputs": input_paths,
    }
    stages[stage_name] = stage
    pipeline["stages"] = stages
    ck_info["pipeline"] = pipeline
    pdf_output_path = os.path.join(
        path, target_path.removesuffix(".tex") + ".pdf"
    )
    publication = {
        "path": pdf_output_path,
        "title": title,
        "description": description,
        "kind": kind,
        "stage": stage_name,
    }
    publications.append(publication)
    ck_info["publications"] = publications
    if not import_zip_mode and overleaf_repo is not None:
        overleaf_sync_in_ck_info = ck_info.get("overleaf_sync", {})
        overleaf_sync_in_ck_info[path] = {"url": overleaf_project_url}
        ck_info["overleaf_sync"] = overleaf_sync_in_ck_info
        last_overleaf_sync_commit = overleaf_repo.head.commit.hexsha
        calkit.overleaf.write_sync_info(
            synced_path=path,
            info={
                "project_id": overleaf_project_id,
                "last_sync_commit": last_overleaf_sync_commit,
            },
            wdir=repo.working_dir,
        )
    elif not import_zip_mode and overleaf_repo is None:
        raise HTTPException(500, "Failed to get Overleaf repo")
    # Copy files into repo
    dest_pub_dir = os.path.join(repo.working_dir, path)
    if not import_zip_mode:
        shutil.copytree(
            src=overleaf_abs_path,
            dst=dest_pub_dir,
            ignore=lambda src, names: [
                ".git",
                target_path.removesuffix(".tex") + ".pdf",
            ],
        )
    else:
        # Make sure the output PDF doesn't exist
        pdf_path = os.path.join(repo.working_dir, pdf_output_path)
        if os.path.isfile(pdf_path):
            logger.info("PDF was part of Overleaf ZIP; removing")
            os.remove(pdf_path)
    # Add publication-specific .gitignore
    gitignore_txt = (
        "\n".join(
            [
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
            ]
        )
        + "\n"
    )
    with open(os.path.join(dest_pub_dir, ".gitignore"), "w") as f:
        f.write(gitignore_txt)
    if not repo.ignored(".calkit/overleaf/"):
        with open(os.path.join(repo.working_dir, ".gitignore"), "a") as f:
            f.write("\n.calkit/overleaf/\n")
        repo.git.add(".gitignore")
    with open(os.path.join(repo.working_dir, "calkit.yaml"), "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    if not import_zip_mode:
        repo.git.add(calkit.overleaf.get_sync_info_fpath())
    repo.git.add(path)
    subprocess.run(
        ["calkit", "check", "pipeline", "--compile"], cwd=repo.working_dir
    )
    repo.git.add("dvc.yaml")
    if auto_build:
        workflow_dir = os.path.join(repo.working_dir, ".github", "workflows")
        os.makedirs(workflow_dir, exist_ok=True)
        workflow_files = os.listdir(workflow_dir)
        has_calkit_workflow = False
        for fname in workflow_files:
            workflow_fpath = os.path.join(workflow_dir, fname)
            with open(workflow_fpath) as f:
                workflow_txt = f.read()
            if "calkit" in workflow_txt:
                has_calkit_workflow = True
                break
        if not has_calkit_workflow:
            download_url = (
                "https://raw.githubusercontent.com/calkit/"
                "run-action/refs/heads/main/example.yml"
            )
            download_resp = requests.get(download_url)
            workflow_rel_path = os.path.join(
                ".github", "workflows", "run-calkit.yml"
            )
            workflow_fpath = os.path.join(repo.working_dir, workflow_rel_path)
            with open(workflow_fpath, "w") as f:
                f.write(download_resp.text)
            repo.git.add(workflow_rel_path)
    commit_msg = (
        f"Import Overleaf project ID {overleaf_project_id} to '{path}'"
        if not import_zip_mode
        else f"Import Overleaf ZIP to '{path}'"
    )
    repo.git.commit(["-m", commit_msg])
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
    try:
        users.get_overleaf_token(session=session, user=current_user)
    except HTTPException:
        raise HTTPException(401, "Overleaf token not found")
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="write",
    )
    repo = get_repo(project=project, user=current_user, session=session)
    ck_info = get_ck_info_from_repo(repo)
    overleaf_sync_info = calkit.overleaf.get_sync_info(
        wdir=repo.working_dir, ck_info=ck_info, fix_legacy=True
    )
    if Path(req.path).as_posix() in overleaf_sync_info:
        path_in_project = Path(req.path).as_posix()
    else:
        path_in_project = Path(os.path.dirname(req.path)).as_posix()
    if path_in_project not in overleaf_sync_info:
        raise HTTPException(404, "Overleaf sync info not found for path")
    overleaf_project_id = overleaf_sync_info[path_in_project]["project_id"]
    overleaf_repo = get_overleaf_repo(
        project=project,
        user=current_user,
        session=session,
        overleaf_project_id=overleaf_project_id,
    )
    try:
        res = calkit.overleaf.sync(
            main_repo=repo,
            overleaf_repo=overleaf_repo,
            path_in_project=path_in_project,
            sync_info_for_path=overleaf_sync_info[path_in_project],
            print_info=logger.info,
            no_commit=False,
        )
    except Exception as e:
        logger.info(f"Failed to sync: {e}")
        if "in the middle of an am session" in repo.git.status():
            repo.git.am("--abort")
        mixpanel.track(
            user=current_user,
            event_name="Overleaf sync failed",
            add_event_info={"path": path_in_project, "exception": str(e)},
        )
        raise HTTPException(
            400, "Overleaf sync failed; try locally with Calkit CLI"
        )
    # Push the main repo (Overleaf has already been pushed in sync)
    repo.git.push(["origin", repo.active_branch.name])
    # Get data from the result of the sync
    commits_since = res.get("commits_since_last_sync", [])
    last_overleaf_commit = res.get("overleaf_commit_after", "")
    last_project_commit = res.get("project_commit_after", "")
    committed_overleaf = res.get("committed_overleaf", False)
    committed_project = res.get("committed_project", False)
    mixpanel.track(
        user=current_user,
        event_name="Overleaf sync",
        add_event_info={
            "path": path_in_project,
            "commits_from_overleaf": len(commits_since),
            "committed_overleaf": committed_overleaf,
            "committed_project": committed_project,
        },
    )
    return OverleafSyncResponse(
        commits_from_overleaf=len(commits_since),
        overleaf_commit=last_overleaf_commit,
        project_commit=last_project_commit,
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
    ref: str | None = None,
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
        ref=ref,
    )
    # Read files at the requested ref rather than the live checkout, which
    # always reflects the default branch (get_repo only fetches a ref, it
    # does not check it out).
    tree = app.projects.get_repo_tree_for_ref(repo, ref)
    if not tree.is_file("dvc.yaml"):
        return
    dvc_content = tree.read_text("dvc.yaml")
    dvc_pipeline = ryaml.load(dvc_content)
    # Pop off any private stages
    for stage_name in list(dvc_pipeline.get("stages", {}).keys()):
        if stage_name.startswith("_"):
            dvc_pipeline["stages"].pop(stage_name)
    if tree.is_file("params.yaml"):
        params = ryaml.load(tree.read_text("params.yaml"))
    else:
        params = None
    # Generate Mermaid diagram
    mermaid = make_mermaid_diagram(dvc_pipeline, params=params)
    logger.info(
        f"Created Mermaid diagram for {owner_name}/{project_name}:\n{mermaid}"
    )
    # See if we can read a Calkit pipeline
    calkit_content = None
    if tree.is_file("calkit.yaml"):
        ck_info = ryaml.load(tree.read_text("calkit.yaml"))
        if "pipeline" in ck_info:
            stream = io.StringIO()
            ryaml.dump({"pipeline": ck_info["pipeline"]}, stream)
            calkit_content = stream.getvalue()
    # Compute per-stage staleness against the committed dvc.lock
    stage_statuses: dict = {}
    overall_status = "unknown"
    try:
        dvc_lock: dict = {}
        if tree.is_file("dvc.lock"):
            dvc_lock = ryaml.load(tree.read_bytes("dvc.lock").decode()) or {}
        stage_statuses = compute_stage_statuses(
            dvc_yaml=dvc_pipeline,
            dvc_lock=dvc_lock,
            tree=tree,
            owner_name=project.owner_account_name,
            project_name=project.name,
            cache_token=resolve_commit_sha(repo, ref),
        )
        overall_status = calc_overall_pipeline_status(stage_statuses)
        mermaid = color_mermaid_by_status(mermaid, stage_statuses)
    except Exception as e:
        logger.warning(f"Failed to compute pipeline status: {e}")
    return Pipeline(
        dvc_stages=dvc_pipeline["stages"],
        mermaid=mermaid,
        dvc_yaml=dvc_content,
        calkit_yaml=calkit_content,
        stage_statuses=stage_statuses,
        status=overall_status,
    )


class Collaborator(BaseModel):
    user_id: uuid.UUID | None = None
    # None for native (GitHub-less) collaborators added by email.
    github_username: str | None = None
    # The Calkit account name, shown when there's no GitHub username.
    account_name: str | None = None
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
    collabs = []
    listed_user_ids: set[uuid.UUID] = set()
    github_repo = project.github_repo
    # GitHub repo collaborators (best-effort: a GitHub-less viewer uses the App
    # token; if listing fails we still return native members below rather than
    # erroring the whole page).
    token = (
        _github_token_for_repo(session, current_user, github_repo)
        if github_repo
        else None
    )
    if github_repo and token:
        url = f"https://api.github.com/repos/{github_repo}/collaborators"
        resp = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code == 200:
            for gh_user in resp.json():
                # TODO: Organization handling
                if gh_user["type"] != "User":
                    continue
                user = session.exec(
                    select(User).where(
                        User.github_username == gh_user["login"]
                    )
                ).first()
                obj = dict(
                    github_username=gh_user["login"],
                    access_level=gh_user["role_name"],
                )
                if user is not None:
                    obj["email"] = user.email
                    obj["full_name"] = user.full_name
                    obj["account_name"] = user.account.name
                    obj["user_id"] = user.id
                    listed_user_ids.add(user.id)
                collabs.append(Collaborator.model_validate(obj))
        else:
            logger.warning(
                f"Could not list GitHub collaborators for {github_repo}: "
                f"{resp.status_code}"
            )
    # Native (GitHub-less) members granted via an invite or a direct add.
    native = session.exec(
        select(User, UserProjectAccess.role_id)
        .join(UserProjectAccess, UserProjectAccess.user_id == User.id)  # type: ignore[arg-type]
        .where(UserProjectAccess.project_id == project.id)
        .where(UserProjectAccess.role_id.is_not(None))  # type: ignore
    ).all()
    for user, role_id in native:
        if user.id in listed_user_ids:
            continue
        collabs.append(
            Collaborator.model_validate(
                dict(
                    user_id=user.id,
                    github_username=user.github_username,
                    account_name=user.account.name,
                    full_name=user.full_name,
                    email=user.email,
                    access_level=ROLE_NAMES[role_id],
                )
            )
        )
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
        .join(Account, Account.user_id == User.id)  # type: ignore[arg-type]
        .where(Account.github_name == github_username)
    ).first()
    if user is None:
        raise HTTPException(404, "User not found")
    logger.info(
        f"Fetched user account {user.email} with GitHub username "
        f"{github_username}"
    )
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
        access.github_access = "write"
    else:
        session.add(
            UserProjectAccess(
                user_id=user.id, project_id=project.id, github_access="write"
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
        .join(Account, Account.user_id == User.id)  # type: ignore[arg-type]
        .where(Account.github_name == github_username)
    ).first()
    if user is None:
        raise HTTPException(404, "User not found")
    logger.info(
        f"Fetched user account {user.email} with GitHub username "
        f"{github_username}"
    )
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
        access.github_access = None
    else:
        session.add(
            UserProjectAccess(
                user_id=user.id, project_id=project.id, github_access=None
            )
        )
    session.commit()
    return Message(message="Success")


class NativeCollaboratorPost(BaseModel):
    email: str


@router.post("/projects/{owner_name}/{project_name}/collaborators/by-email")
def post_project_collaborator_by_email(
    owner_name: str,
    project_name: str,
    req: NativeCollaboratorPost,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
    """Grant native (non-GitHub) write access to an existing Calkit user by
    email -- how a GitHub-less collaborator is added. For people who don't have
    a Calkit account yet, use an invite link instead.
    """
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="admin",
    )
    user = users.get_user_by_email(session=session, email=req.email)
    if user is None:
        raise HTTPException(
            404,
            "No Calkit user has that email. Send them an invite link to join.",
        )
    if user.id == project.owner_account.user_id:
        raise HTTPException(400, "That user already owns this project.")
    write_role = ROLE_IDS["write"]
    existing = session.exec(
        select(UserProjectAccess)
        .where(UserProjectAccess.project_id == project.id)
        .where(UserProjectAccess.user_id == user.id)
    ).first()
    if existing is None:
        session.add(
            UserProjectAccess(
                user_id=user.id,
                project_id=project.id,
                role_id=write_role,
                invited_by_user_id=current_user.id,
            )
        )
    elif existing.role_id is None or existing.role_id < write_role:
        existing.role_id = write_role
        if existing.invited_by_user_id is None:
            existing.invited_by_user_id = current_user.id
        session.add(existing)
    session.commit()
    return Message(message="Success")


@router.delete(
    "/projects/{owner_name}/{project_name}/collaborators/by-user/{user_id}"
)
def delete_project_native_collaborator(
    owner_name: str,
    project_name: str,
    user_id: uuid.UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
    """Revoke a native (non-GitHub) collaborator's access. GitHub collaborators
    are removed via the github-username endpoint instead.
    """
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="admin",
    )
    row = session.exec(
        select(UserProjectAccess)
        .where(UserProjectAccess.project_id == project.id)
        .where(UserProjectAccess.user_id == user_id)
    ).first()
    if row is None or row.role_id is None:
        raise HTTPException(404, "Collaborator not found")
    # Drop the native grant; any cached GitHub-derived access is left as-is.
    row.role_id = None
    row.invited_by_user_id = None
    session.add(row)
    session.commit()
    return Message(message="Success")


@router.post("/projects/{owner_name}/{project_name}/invitations")
def post_project_invitation(
    owner_name: str,
    project_name: str,
    req: ProjectInvitationPost,
    current_user: CurrentUser,
    session: SessionDep,
) -> ProjectInvitationCreated:
    """Create a shareable invite link granting native project membership.

    The raw token is returned only here; the DB stores its hash. Invite links
    grant collaborator access only (read or write) — never admin or ownership;
    admins must be added deliberately, not via a shareable link.
    """
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="admin",
    )
    token = generate_refresh_token()
    expires = (
        utcnow() + timedelta(days=req.expires_days)
        if req.expires_days is not None
        else None
    )
    invitation = ProjectInvitation(
        project_id=project.id,
        token_hash=hash_refresh_token(token),
        role_id=ROLE_IDS[req.role],
        name=req.name,
        email=req.email,
        created_by_user_id=current_user.id,
        expires=expires,
        max_uses=req.max_uses,
    )
    session.add(invitation)
    session.commit()
    session.refresh(invitation)
    url = f"{settings.frontend_host.rstrip('/')}/join/{token}"
    # Best-effort: email the link if a recipient was given and SMTP is set up.
    # Never fail the request over email; the creator still gets the copyable URL.
    emailed = False
    if req.email and settings.emails_enabled:
        inviter = current_user.full_name or current_user.email
        email_data = messaging.generate_project_invitation_email(
            email_to=req.email,
            project_name=project.name,
            link=url,
            inviter=inviter,
            role=req.role,
        )
        try:
            messaging.send_email(
                email_to=req.email,
                subject=email_data.subject,
                html_content=email_data.html_content,
            )
            emailed = True
        except Exception:
            logger.exception(f"Failed to send invite email to {req.email}")
    return ProjectInvitationCreated(
        id=invitation.id,
        name=invitation.name,
        email=invitation.email,
        role_name=invitation.role_name,
        created=invitation.created,
        expires=invitation.expires,
        max_uses=invitation.max_uses,
        use_count=invitation.use_count,
        revoked=invitation.revoked,
        token=token,
        url=url,
        emailed=emailed,
    )


@router.get("/projects/{owner_name}/{project_name}/invitations")
def get_project_invitations(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[ProjectInvitationPublic]:
    project = app.projects.get_project(
        owner_name=owner_name,
        project_name=project_name,
        session=session,
        current_user=current_user,
        min_access_level="admin",
    )
    invitations = session.exec(
        select(ProjectInvitation)
        .where(ProjectInvitation.project_id == project.id)
        .order_by(sqlalchemy.desc(ProjectInvitation.created))  # type: ignore
    ).all()
    return list(invitations)  # type: ignore[return-value]


@router.delete(
    "/projects/{owner_name}/{project_name}/invitations/{invitation_id}"
)
def delete_project_invitation(
    owner_name: str,
    project_name: str,
    invitation_id: uuid.UUID,
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
    invitation = session.get(ProjectInvitation, invitation_id)
    if invitation is None or invitation.project_id != project.id:
        raise HTTPException(404, "Invitation not found")
    invitation.revoked = True
    session.add(invitation)
    session.commit()
    return Message(message="Invitation revoked")


@router.post("/project-invitations/{token}")
def post_project_invitation_redemption(
    token: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> ProjectInvitationRedeemed:
    """Redeem an invite link, granting the current user native membership."""
    # Lock the invitation row for the transaction so concurrent redemptions
    # serialize: without this, two redeems can both read the same use_count,
    # both pass is_valid, and both increment past max_uses.
    invitation = session.exec(
        select(ProjectInvitation)
        .where(ProjectInvitation.token_hash == hash_refresh_token(token))
        .with_for_update()
    ).first()
    if invitation is None:
        raise HTTPException(404, "Invitation not found")
    if not invitation.is_valid:
        raise HTTPException(410, "Invitation is no longer valid")
    project = session.get(Project, invitation.project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    # Project owners already have full access; don't create a lesser membership.
    if project.owner_account.user_id == current_user.id:
        return ProjectInvitationRedeemed(
            owner_name=project.owner_account.name,
            project_name=project.name,
            role_name="owner",
        )
    # Invite links never confer more than collaborator (write) access, even if
    # a legacy link was created with a higher role. Admins are added directly.
    granted_role_id = min(invitation.role_id, ROLE_IDS["write"])
    existing = session.exec(
        select(UserProjectAccess)
        .where(UserProjectAccess.project_id == project.id)
        .where(UserProjectAccess.user_id == current_user.id)
    ).first()
    if existing is None:
        session.add(
            UserProjectAccess(
                user_id=current_user.id,
                project_id=project.id,
                role_id=granted_role_id,
                invited_by_user_id=invitation.created_by_user_id,
            )
        )
    elif existing.role_id is None or granted_role_id > existing.role_id:
        # Grant, or upgrade if the invite confers more than they already have
        # (the row may have existed as GitHub-derived access with no role_id).
        existing.role_id = granted_role_id
        if existing.invited_by_user_id is None:
            existing.invited_by_user_id = invitation.created_by_user_id
        session.add(existing)
    invitation.use_count += 1
    session.add(invitation)
    session.commit()
    return ProjectInvitationRedeemed(
        owner_name=project.owner_account.name,
        project_name=project.name,
        role_name=invitation.role_name,
    )


class Issue(BaseModel):
    id: int
    number: int
    url: str
    user_github_username: str
    state: Literal["open", "closed"]
    title: str
    body: str | None
    artifact_type: str | None = None
    artifact_path: str | None = None


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
        token = _github_token_for_repo(session, current_user, github_repo)
        if token is not None:
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
    # Build a map from GitHub issue URL → (artifact_type, artifact_path)
    # for issues that were created from project comments
    db_comments = session.exec(
        select(ProjectComment).where(
            ProjectComment.project_id == project.id,
            ProjectComment.external_url.is_not(None),  # type: ignore[union-attr]
        )
    ).all()
    comment_by_url: dict[str, ProjectComment] = {
        c.external_url: c for c in db_comments if c.external_url
    }
    resp_fmt = []
    for issue in resp_json:
        linked = comment_by_url.get(issue["html_url"])
        resp_fmt.append(
            Issue(
                id=issue["id"],
                number=issue["number"],
                url=issue["html_url"],
                user_github_username=issue["user"]["login"],
                state=issue["state"],
                title=issue["title"],
                body=issue["body"],
                artifact_type=linked.artifact_type if linked else None,
                artifact_path=linked.artifact_path if linked else None,
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
    if project.github_repo is None:
        raise HTTPException(501)
    token = _github_token_for_repo(session, current_user, project.github_repo)
    if token is None:
        raise HTTPException(
            502, "Could not authenticate with GitHub to create the issue"
        )
    body = f"{_make_github_authorship_prefix(current_user)}{req.body or ''}"
    url = f"https://api.github.com/repos/{project.github_repo}/issues"
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}"},
        json={"title": req.title, "body": body},
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
        min_access_level="write",
    )
    if project.github_repo is None:
        raise HTTPException(501)
    # Use the App-token fallback so GitHub-less collaborators can close/reopen
    # issues too (consistent with creating and commenting on them).
    token = _github_token_for_repo(session, current_user, project.github_repo)
    if token is None:
        raise HTTPException(
            502, "Could not authenticate with GitHub to update the issue"
        )
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
    ref: str | None = None,
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
        ref=ref,
    )
    ck_info = get_ck_info_from_repo(repo)
    ref_collections = ck_info.get("references", [])
    declared_paths = {rc["path"] for rc in ref_collections}
    # Auto-detect undeclared .bib files in the repo tree
    try:
        commit = repo.commit(ref) if ref else repo.head.commit
        for blob in commit.tree.traverse():
            if blob.type != "blob":  # type: ignore[union-attr]
                continue
            path: str = blob.path  # type: ignore[union-attr]
            parts = path.split("/")
            if any(p.startswith(".") for p in parts):
                continue
            if not path.lower().endswith(".bib"):
                continue
            if path in declared_paths:
                continue
            ref_collections.append({"path": path})
    except Exception as e:
        logger.warning(f"Failed to scan for undeclared references: {e}")
    resp = []
    for ref_collection in ref_collections:
        # Read entries
        path = ref_collection["path"]
        if os.path.isfile(os.path.join(repo.working_dir, path)):
            with open(os.path.join(repo.working_dir, path)) as f:
                raw_text = f.read()
            ref_collection["raw_text"] = raw_text
            try:
                refs = bibtexparser.loads(raw_text)
                entries = refs.entries
            except Exception as e:
                logger.warning(f"Failed to parse BibTeX file {path}: {e}")
                entries = []
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
                            ref=ref,
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
    ref: str | None = None,
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
        ref=ref,
    )
    ck_info = app.projects.get_ck_info_for_ref(
        project=project,
        repo=repo,
        ref=ref,
    )
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
    ref: str | None = None,
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
    ck_info = app.projects.get_ck_info_for_ref(
        project=project,
        repo=repo,
        ref=ref,
    )
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


class SoftwareItem(BaseModel):
    title: str
    path: str
    description: str | None = None


class Software(BaseModel):
    items: list[SoftwareItem]


@router.get("/projects/{owner_name}/{project_name}/software")
def get_project_software(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ref: str | None = None,
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
        ref=ref,
    )
    ck_info = app.projects.get_ck_info_for_ref(
        project=project,
        repo=repo,
        ref=ref,
    )
    raw = ck_info.get("software", [])
    items = []
    for entry in raw:
        try:
            items.append(SoftwareItem.model_validate(entry))
        except ValidationError as e:
            logger.warning(f"Invalid software entry: {e}")
    return Software(items=items)


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
    ref: str | None = None,
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
        ref=ref,
    )
    ck_info = app.projects.get_ck_info_for_ref(
        project=project,
        repo=repo,
        ref=ref,
    )
    notebooks = ck_info.get("notebooks", [])
    # Also detect undeclared .ipynb files not under hidden directories
    declared_paths = {nb["path"] for nb in notebooks}
    try:
        for root, dirs, files in os.walk(repo.working_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for fname in files:
                if fname.endswith(".ipynb"):
                    rel = os.path.relpath(
                        os.path.join(root, fname), repo.working_dir
                    )
                    if rel not in declared_paths:
                        notebooks.append({"path": rel})
                        declared_paths.add(rel)
    except Exception as e:
        logger.warning(f"Failed to scan for undeclared notebooks: {e}")
    if not notebooks:
        return notebooks
    # Detect stages from jupyter-notebook ``notebook_path`` items
    pipeline = ck_info.get("pipeline", {})
    stages = pipeline.get("stages", {})
    nb_path_to_stage_name = {}
    for stage_name, stage in stages.items():
        if stage.get("kind") == "jupyter-notebook":
            nb_path = stage.get("notebook_path")
            if nb_path:
                nb_path_to_stage_name[nb_path] = stage_name
    for nb in notebooks:
        nb_path = nb.get("path")
        if nb_path in nb_path_to_stage_name:
            nb["stage"] = nb_path_to_stage_name[nb_path]
    # Get the notebook content and base64 encode it
    tree = app.projects.get_repo_tree_for_ref(repo, ref)
    (
        ck_info_full,
        dvc_lock_outs,
        zip_path_map,
        _,
    ) = app.projects.get_ck_info_and_dvc_outs_from_tree(project, tree)
    for notebook in notebooks:
        try:
            item = app.projects.get_contents_from_tree(
                project=project,
                tree=tree,
                path=notebook["path"],
                ck_info=ck_info_full,
                dvc_lock_outs=dvc_lock_outs,
                zip_path_map=zip_path_map,
            )
        except HTTPException:
            continue
        try:
            # If the notebook has a pre-built HTML output, prefer that
            html_path = get_executed_notebook_path(
                notebook_path=notebook["path"], to="html"
            )
            html_item = app.projects.get_contents_from_tree(
                project=project,
                tree=tree,
                path=html_path,
                ck_info=ck_info_full,
                dvc_lock_outs=dvc_lock_outs,
            )
            item = html_item
            notebook["output_format"] = "html"
        except HTTPException as e:
            logger.info(f"Notebook HTML does not exist at {html_path}: {e}")
        notebook["url"] = item.url
        notebook["content"] = item.content
        notebook["storage"] = item.storage
        # Figure out the output format from the URL content disposition
        if item.url is not None:
            params = params_from_url(item.url)
            rcd = params.get("response-content-disposition")
            if rcd is not None:
                if rcd[0].endswith(".ipynb"):
                    notebook["output_format"] = "notebook"
                elif rcd[0].endswith(".html"):
                    notebook["output_format"] = "html"
        # Default: raw .ipynb content (no HTML version available)
        if not notebook.get("output_format") and item.content and not item.url:
            notebook["output_format"] = "notebook"
    return [Notebook.model_validate(nb) for nb in notebooks]


@router.get("/projects/{owner_name}/{project_name}/repro-check")
def get_project_repro_check(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ref: str | None = None,
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
        ref=ref,
    )
    res = check_reproducibility(wdir=str(repo.working_dir))
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
    ref: str | None = None,
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
        ref=ref,
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
    ref: str | None = None,
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
        project=project,
        user=current_user,
        session=session,
        ttl=ttl,
        ref=ref,
    )
    ck_info = app.projects.get_ck_info_for_ref(
        project=project,
        repo=repo,
        ref=ref,
    )
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
    # Compute pipeline staleness once so publication elements can surface a
    # "stale" badge. Best-effort: never let it break the showcase.
    showcase_stage_statuses: dict = {}
    showcase_dvc_lock: dict = {}
    try:
        showcase_tree = app.projects.get_repo_tree_for_ref(repo, ref)
        if showcase_tree.is_file("dvc.lock"):
            showcase_dvc_lock = (
                ryaml.load(showcase_tree.read_bytes("dvc.lock").decode()) or {}
            )
        showcase_dvc_yaml: dict = {}
        if showcase_tree.is_file("dvc.yaml"):
            showcase_dvc_yaml = (
                ryaml.load(showcase_tree.read_bytes("dvc.yaml").decode()) or {}
            )
        showcase_stage_statuses = compute_stage_statuses(
            dvc_yaml=showcase_dvc_yaml,
            dvc_lock=showcase_dvc_lock,
            tree=showcase_tree,
            owner_name=project.owner_account_name,
            project_name=project.name,
            fs=get_object_fs(),
            cache_token=resolve_commit_sha(repo, ref),
        )
    except Exception as e:
        logger.warning(f"Failed to compute pipeline status for showcase: {e}")
    elements_out = []
    for element_in in inputs.elements:
        if isinstance(element_in, ShowcaseFigureInput):
            try:
                element_out = ShowcaseFigure(
                    figure=app.projects.get_figure_from_repo(
                        project=project,
                        repo=repo,
                        path=element_in.figure,
                        ref=ref,
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
                        ref=ref,
                    )
                )
                pub = element_out.publication
                if not pub.stage and pub.path:
                    auto_stage = find_stage_for_path(
                        pub.path, showcase_dvc_lock
                    )
                    if auto_stage is not None:
                        pub.stage = auto_stage
                if pub.stage and pub.stage in showcase_stage_statuses:
                    pub.stage_status = showcase_stage_statuses[pub.stage]
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
                        ref=ref,
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
