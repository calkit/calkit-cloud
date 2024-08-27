"""Functionality for working with Git."""

import os
import subprocess

import git
from app import users
from app.core import logger
from app.models import Project, User
from sqlmodel import Session


def get_repo(project: Project, user: User, session: Session) -> git.Repo:
    """Ensure that the repo exists and is ready for operating upon for the
    user.
    """
    owner_name = project.owner_github_username
    project_name = project.name_slug
    # Add the file to the repo(s) -- we may need to clone it
    # If it already exists, just git pull
    base_dir = f"/tmp/{owner_name}/{project_name}"
    os.makedirs(base_dir, exist_ok=True)
    os.chdir(base_dir)
    # Clone the repo if it doesn't exist -- it will be in a "repo" dir
    access_token = users.get_github_token(session=session, user=user)
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
        # TODO: Only pull if we know we need to, perhaps with a call to GitHub
        # for the latest rev
        repo.git.pull()
    repo_contents = os.listdir(".")
    logger.info(f"Repo contents: {repo_contents}")
    # Run git config so we make commits as this user
    repo.git.config(["user.name", user.full_name])
    repo.git.config(["user.email", user.email])
    return repo
