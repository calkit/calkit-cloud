"""Functionality for working with Git."""

import os
import subprocess
import time

import git
from app import users
from app.core import logger, ryaml
from app.models import Project, User
from filelock import FileLock, Timeout
from sqlmodel import Session


def get_repo(
    project: Project, user: User, session: Session, ttl=None
) -> git.Repo:
    """Ensure that the repo exists and is ready for operating upon for the
    user.

    Note that we need to handle concurrency here in case multiple API calls
    have been made at the same time that request the repo.
    """
    owner_name = project.owner_github_name
    project_name = project.name_slug
    # Add the file to the repo(s) -- we may need to clone it
    # If it already exists, just git pull
    base_dir = f"/tmp/{user.github_username}/{owner_name}/{project_name}"
    repo_dir = os.path.join(base_dir, "repo")
    updated_fpath = os.path.join(base_dir, "updated.txt")
    lock_fpath = os.path.join(base_dir, "updating.lock")
    lock = FileLock(lock_fpath, timeout=1)
    os.makedirs(base_dir, exist_ok=True)
    # Clone the repo if it doesn't exist -- it will be in a "repo" dir
    access_token = users.get_github_token(session=session, user=user)
    git_clone_url = (
        f"https://x-access-token:{access_token}@"
        f"{project.git_repo_url.removeprefix('https://')}.git"
    )
    newly_cloned = False
    if not os.path.isdir(repo_dir):
        newly_cloned = True
        logger.info(f"Git cloning into {repo_dir}")
        try:
            with lock:
                subprocess.call(
                    ["git", "clone", "--depth", "1", git_clone_url, repo_dir]
                )
                # Touch a file so we can compute a TTL
                subprocess.call(["touch", updated_fpath])
                repo = git.Repo(repo_dir)
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
                    repo.remote().set_url(git_clone_url)
                    logger.info("Git fetching")
                    branch_name = repo.active_branch.name
                    repo.git.fetch(["origin", branch_name])
                    repo.git.checkout([f"origin/{branch_name}"])
                    repo.git.branch(["-D", branch_name])
                    repo.git.checkout(["-b", branch_name])
                    subprocess.call(["touch", updated_fpath])
        except Timeout:
            logger.warning("Git repo lock timed out")
    return repo


def get_ck_info_from_repo(repo: git.Repo) -> dict:
    if os.path.isfile(os.path.join(repo.working_dir, "calkit.yaml")):
        with open(os.path.join(repo.working_dir, "calkit.yaml")) as f:
            return ryaml.load(f)
    else:
        return {}


def get_ck_info(
    project: Project, user: User, session: Session, ttl=None
) -> dict:
    """Load the calkit.yaml file contents into a dictionary."""
    repo = get_repo(project=project, user=user, session=session, ttl=ttl)
    return get_ck_info_from_repo(repo=repo)


def get_dvc_pipeline(
    project: Project, user: User, session: Session, ttl=None
) -> dict:
    repo = get_repo(project=project, user=user, session=session, ttl=ttl)
    if os.path.isfile(os.path.join(repo.working_dir, "dvc.yaml")):
        with open(os.path.join(repo.working_dir, "dvc.yaml")) as f:
            return ryaml.load(f)
    else:
        return {}
