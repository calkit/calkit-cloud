"""Functionality for working with Git."""

import os
import shutil
import subprocess
import time

import calkit
import git
from fastapi import HTTPException
from filelock import FileLock, Timeout
from git.exc import GitCommandError
from sqlmodel import Session

from app import users
from app.core import logger, ryaml
from app.models import Project, User


def get_repo(
    project: Project,
    user: User | None,
    session: Session,
    ttl: int | None = None,
    fresh=False,
) -> git.Repo:
    """Ensure that the repo exists and is ready for operating upon for the
    user.

    Note that we need to handle concurrency here in case multiple API calls
    have been made at the same time that request the repo.

    If TTL is None, we will always attempt to pull the latest version.
    """
    owner_name = project.owner_github_name
    project_name = project.name
    # Add the file to the repo(s) -- we may need to clone it
    # If it already exists, just git pull
    if user is not None:
        base_dir = f"/tmp/{user.github_username}/{owner_name}/{project_name}"
    else:
        base_dir = f"/tmp/anonymous/{owner_name}/{project_name}"
    repo_dir = os.path.join(base_dir, "repo")
    updated_fpath = os.path.join(base_dir, "updated.txt")
    lock_fpath = os.path.join(base_dir, "updating.lock")
    lock = FileLock(lock_fpath, timeout=5)
    os.makedirs(base_dir, exist_ok=True)
    if os.path.isdir(repo_dir) and fresh:
        logger.info("Deleting repo directory to clone a fresh copy")
        shutil.rmtree(repo_dir, ignore_errors=True)
    # Clone the repo if it doesn't exist -- it will be in a "repo" dir
    if user is not None:
        logger.info(f"Getting {user.email}'s access token for Git repo URL")
        access_token = users.get_github_token(session=session, user=user)
        git_clone_url = (
            f"https://x-access-token:{access_token}@"
            f"{project.git_repo_url.removeprefix('https://')}.git"
        )
    else:
        logger.info("Using public Git repo URL")
        git_clone_url = project.git_repo_url
    newly_cloned = False
    repo = None
    if not os.path.isdir(repo_dir):
        newly_cloned = True
        logger.info(f"Git cloning into {repo_dir}")
        try:
            with lock:
                try:
                    subprocess.check_call(
                        [
                            "git",
                            "clone",
                            "--depth",
                            "1",
                            git_clone_url,
                            repo_dir,
                        ]
                    )
                except subprocess.CalledProcessError:
                    logger.error("Failed to clone repo")
                    # It's possible another process cloned this repo just as
                    # we were about to, so check again
                    if not os.path.isdir(repo_dir):
                        raise HTTPException(404, "Git repo not found")
                # Touch a file so we can compute a TTL
                subprocess.check_call(["touch", updated_fpath])
                repo = git.Repo(repo_dir)
                if user is not None:
                    # Run git config so we make commits as this user
                    repo.git.config(["user.name", user.full_name])
                    repo.git.config(["user.email", user.email])
        except Timeout:
            logger.warning("Git repo lock timed out")
    if os.path.isfile(updated_fpath):
        last_updated = os.path.getmtime(updated_fpath)
    else:
        last_updated = 0
    if not newly_cloned:
        # TODO: Only pull if we know we need to, perhaps with a call to GitHub
        # for the latest rev
        repo = git.Repo(repo_dir)
        try:
            with lock:
                if ttl is None or ((time.time() - last_updated) > ttl):
                    logger.info("Updating remote in case token was refreshed")
                    branch_name = repo.active_branch.name
                    repo.git.remote(["remove", "origin"])
                    repo.git.remote(["add", "origin", git_clone_url])
                    logger.info("Git fetching")
                    repo.git.fetch(["origin", branch_name])
                    # If we had any failed previous transactions, reset and
                    # clean
                    repo.git.reset()
                    repo.git.clean("-fd")
                    repo.git.stash("save", "Auto-stash before pull")
                    repo.git.checkout([f"origin/{branch_name}"])
                    repo.git.branch(["-D", branch_name])
                    repo.git.checkout(["-b", branch_name])
                    subprocess.call(["touch", updated_fpath])
        except Timeout:
            logger.warning("Git repo lock timed out")
        except GitCommandError as e:
            logger.error(f"Failed to refresh repo: {e}")
    if repo is None:
        repo = git.Repo(repo_dir)
    return repo


def get_ck_info_from_repo(repo: git.Repo, process_includes=False) -> dict:
    ck_info = calkit.load_calkit_info(
        wdir=repo.working_dir, process_includes=process_includes
    )
    if ck_info is None:
        ck_info = {}
    return ck_info


def get_ck_info(
    project: Project,
    user: User | None,
    session: Session,
    ttl=None,
    process_includes=False,
) -> dict:
    """Load the calkit.yaml file contents into a dictionary."""
    repo = get_repo(project=project, user=user, session=session, ttl=ttl)
    return get_ck_info_from_repo(repo=repo, process_includes=process_includes)


def get_dvc_pipeline(
    project: Project, user: User, session: Session, ttl=None
) -> dict:
    repo = get_repo(project=project, user=user, session=session, ttl=ttl)
    return get_dvc_pipeline_from_repo(repo)


def get_dvc_pipeline_from_repo(repo: git.Repo) -> dict:
    if os.path.isfile(os.path.join(repo.working_dir, "dvc.yaml")):
        with open(os.path.join(repo.working_dir, "dvc.yaml")) as f:
            return ryaml.load(f)
    else:
        return {}


def get_overleaf_repo(
    project: Project, user: User, session: Session, overleaf_project_id: str
) -> git.Repo:
    """Get a freshly pulled Overleaf repository for a user/project."""
    if user.overleaf_token is None:
        # This should never happen, since it would be checked in the caller
        raise RuntimeError("User has no Overleaf token")
    owner_name, project_name = project.owner_github_name, project.name
    base_dir = (
        f"/tmp/{user.github_username}/{owner_name}/"
        f"{project_name}/overleaf/{overleaf_project_id}"
    )
    repo_dir = os.path.join(base_dir, "repo")
    os.makedirs(base_dir, exist_ok=True)
    overleaf_token = users.get_overleaf_token(session=session, user=user)
    git_clone_url = (
        f"https://git:{overleaf_token}@git.overleaf.com/{overleaf_project_id}"
    )
    if os.path.isdir(repo_dir):
        # We should be able to simply go in here and pull
        repo = git.Repo(repo_dir)
        repo.git.pull()
    else:
        repo = git.Repo.clone_from(git_clone_url, repo_dir)
    # Run git config so we make commits as this user
    repo.git.config(["user.name", user.full_name])
    repo.git.config(["user.email", user.email])
    return repo
