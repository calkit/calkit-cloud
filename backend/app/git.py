"""Functionality for working with Git."""

import os
import subprocess
import time

import git
from app import users
from app.core import logger
from app.models import Project, User
from sqlmodel import Session


def get_repo(
    project: Project, user: User, session: Session, ttl=None
) -> git.Repo:
    """Ensure that the repo exists and is ready for operating upon for the
    user.

    Note that we need to handle concurrency here in case multiple API calls
    have been made at the same time that request the repo.
    """
    owner_name = project.owner_github_username
    project_name = project.name_slug
    # Add the file to the repo(s) -- we may need to clone it
    # If it already exists, just git pull
    base_dir = f"/tmp/{user.github_username}/{owner_name}/{project_name}"
    repo_dir = os.path.join(base_dir, "repo")
    updated_fpath = os.path.join(base_dir, "updated.txt")
    lock_fpath = os.path.join(base_dir, "cloning.lock")
    os.makedirs(base_dir, exist_ok=True)
    # Clone the repo if it doesn't exist -- it will be in a "repo" dir
    access_token = users.get_github_token(session=session, user=user)
    git_clone_url = (
        f"https://x-access-token:{access_token}@"
        f"{project.git_repo_url.removeprefix('https://')}.git"
    )
    cloned = False
    if not os.path.isdir(repo_dir) and not os.path.isfile(lock_fpath):
        cloned = True
        logger.info(f"Git cloning into {repo_dir}")
        subprocess.call(["touch", lock_fpath])
        subprocess.call(
            ["git", "clone", "--depth", "1", git_clone_url, repo_dir]
        )
        # Touch a file so we can compute a TTL
        subprocess.call(["touch", updated_fpath])
        repo = git.Repo(repo_dir)
        # Run git config so we make commits as this user
        repo.git.config(["user.name", user.full_name])
        repo.git.config(["user.email", user.email])
        os.remove(lock_fpath)
    n = 1
    while os.path.isfile(lock_fpath):
        n += 1
        time.sleep(0.01)
        if n > 1000:
            os.remove(lock_fpath)
    if os.path.isfile(updated_fpath):
        last_updated = os.path.getmtime(updated_fpath)
    else:
        last_updated = 0
    if not cloned:
        repo = git.Repo(repo_dir)
        # TODO: Only pull if we know we need to, perhaps with a call to GitHub
        # for the latest rev
        if ttl is None or ((time.time() - last_updated) > ttl):
            logger.info("Updating remote in case token was refreshed")
            repo.remote().set_url(git_clone_url)
            logger.info("Git pulling")
            repo.git.pull()
            subprocess.call(["touch", updated_fpath])
    repo_contents = os.listdir(repo_dir)
    logger.info(f"Repo contents: {repo_contents}")
    return repo
