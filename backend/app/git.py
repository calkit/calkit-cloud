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
    ref: str | None = None,
    full_history: bool = False,
) -> git.Repo:
    """Ensure that the repo exists and is ready for operating upon for the
    user.

    Note that we need to handle concurrency here in case multiple API calls
    have been made at the same time that request the repo.

    If TTL is None, we will always attempt to pull the latest version.
    """
    owner_name = project.owner_github_name
    project_name = project.name
    # Add the file to the repo(s) -- we may need to clone it.
    # Ref-based reads should not mutate this working tree checkout.
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
                    clone_cmd = ["git", "clone"]
                    # Keep clones shallow by default for speed, but allow
                    # full history for git history/ref browsing features.
                    if not full_history:
                        clone_cmd += ["--depth", "1"]
                    clone_cmd += [git_clone_url, repo_dir]
                    subprocess.check_call(clone_cmd)
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
                    repo.git.remote(["remove", "origin"])
                    repo.git.remote(["add", "origin", git_clone_url])
                    logger.info("Git fetching")
                    if full_history:
                        try:
                            is_shallow = (
                                repo.git.rev_parse(
                                    "--is-shallow-repository"
                                ).strip()
                                == "true"
                            )
                        except GitCommandError:
                            is_shallow = os.path.isfile(
                                os.path.join(repo.git_dir, "shallow")
                            )
                        if is_shallow:
                            repo.git.fetch(["--unshallow", "--tags"])
                        else:
                            repo.git.fetch(["--all", "--tags"])
                    elif ref is None:
                        branch_name = repo.active_branch.name
                        repo.git.fetch(["origin", branch_name])
                        # If we had any failed previous transactions, reset
                        # and clean
                        repo.git.reset()
                        repo.git.clean("-fd")
                        repo.git.stash("save", "Auto-stash before pull")
                        repo.git.checkout([f"origin/{branch_name}"])
                        repo.git.branch(["-D", branch_name])
                        repo.git.checkout(["-b", branch_name])
                    else:
                        repo.git.fetch(["--all", "--tags"])
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
    ref: str | None = None,
) -> dict:
    """Load the calkit.yaml file contents into a dictionary."""
    repo = get_repo(
        project=project,
        user=user,
        session=session,
        ttl=ttl,
        ref=ref,
    )
    return get_ck_info_from_repo(repo=repo, process_includes=process_includes)


def get_dvc_pipeline(
    project: Project,
    user: User | None,
    session: Session,
    ttl=None,
    ref: str | None = None,
) -> dict:
    repo = get_repo(
        project=project, user=user, session=session, ttl=ttl, ref=ref
    )
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


def search_refs(
    repo: git.Repo, query: str | None = None
) -> list[dict]:
    """Search for refs (branches, tags, commits) in a repository.

    Args:
        repo: GitPython Repo object
        query: Optional search query to filter by branch name, tag name,
               commit message, or author name

    Returns:
        List of dicts with ref information (name, type, message, author, timestamp)
    """
    from app.models import Ref

    refs = []
    query_lower = query.lower() if query else None

    try:
        # Fetch all refs to ensure we have latest
        repo.remotes.origin.fetch()
    except Exception as e:
        logger.warning(f"Failed to fetch refs: {e}")

    # Add branches
    try:
        for branch in repo.branches:
            name = branch.name
            if query_lower and query_lower not in name.lower():
                # Try to get commit message for fuzzy matching
                try:
                    commit = repo.commit(branch)
                    if query_lower not in (commit.message or "").lower() and \
                       query_lower not in (commit.author.name or "").lower():
                        continue
                except:
                    pass

            try:
                commit = repo.commit(branch)
                refs.append({
                    "name": name,
                    "type": "branch",
                    "message": commit.message.split('\n')[0] if commit.message else None,
                    "author": commit.author.name,
                    "timestamp": commit.committed_datetime.isoformat(),
                    "short_hash": commit.hexsha[:7],
                })
            except Exception as e:
                logger.warning(f"Failed to get commit info for branch {name}: {e}")
                refs.append({
                    "name": name,
                    "type": "branch",
                })
    except Exception as e:
        logger.warning(f"Failed to list branches: {e}")

    # Add tags
    try:
        for tag in repo.tags:
            name = tag.name
            if query_lower and query_lower not in name.lower():
                # Try to get tag message for fuzzy matching
                try:
                    if tag.tag and tag.tag.message:
                        if query_lower not in tag.tag.message.lower():
                            continue
                except:
                    pass

            try:
                commit = repo.commit(tag)
                message = None
                if tag.tag and tag.tag.message:
                    message = tag.tag.message.split('\n')[0]
                elif commit.message:
                    message = commit.message.split('\n')[0]

                refs.append({
                    "name": name,
                    "type": "tag",
                    "message": message,
                    "author": commit.author.name if commit.author else None,
                    "timestamp": commit.committed_datetime.isoformat() if commit.committed_datetime else None,
                    "short_hash": commit.hexsha[:7],
                })
            except Exception as e:
                logger.warning(f"Failed to get commit info for tag {name}: {e}")
                refs.append({
                    "name": name,
                    "type": "tag",
                })
    except Exception as e:
        logger.warning(f"Failed to list tags: {e}")

    # Add recent commits
    try:
        max_commits = 50
        for commit in repo.iter_commits('HEAD', max_count=max_commits):
            short_hash = commit.hexsha[:7]
            message = commit.message.split('\n')[0] if commit.message else ""

            # Check if this commit matches the query
            if query_lower:
                if not (query_lower in short_hash.lower() or
                       query_lower in message.lower() or
                       query_lower in (commit.author.name or "").lower()):
                    continue

            # Avoid duplicates with branches/tags
            if short_hash not in [r.get('short_hash', '') for r in refs]:
                refs.append({
                    "name": short_hash,
                    "type": "commit",
                    "message": message,
                    "author": commit.author.name,
                    "timestamp": commit.committed_datetime.isoformat(),
                    "short_hash": short_hash,
                })
    except Exception as e:
        logger.warning(f"Failed to list commits: {e}")

    # Sort refs: branches first, then tags, then commits; newest first in each
    type_order = {"branch": 0, "tag": 1, "commit": 2}
    refs.sort(
        key=lambda r: (
            type_order.get(r.get("type", "commit"), 3),
            r.get("timestamp") or "",
            r.get("name") or "",
        ),
        reverse=False,
    )
    refs.sort(key=lambda r: r.get("timestamp") or "", reverse=True)
    refs.sort(
        key=lambda r: type_order.get(r.get("type", "commit"), 3),
        reverse=False,
    )

    return [Ref(**r) for r in refs]


def get_file_history(
    repo: git.Repo,
    path: str,
    max_count: int = 100,
) -> list[dict]:
    """Get commit history for a specific file path.

    Checks the file itself, the `<path>.dvc` pointer file, and `dvc.lock`
    (for pipeline outputs) so that DVC-tracked artifacts are covered too.
    Deduplicates by commit hash and returns commits sorted newest-first.
    """
    seen: set[str] = set()
    commits: list[dict] = []

    def _collect(git_path: str) -> None:
        try:
            for commit in repo.iter_commits(
                "HEAD", paths=git_path, max_count=max_count
            ):
                if commit.hexsha in seen:
                    continue
                seen.add(commit.hexsha)
                commits.append(
                    {
                        "hash": commit.hexsha,
                        "short_hash": commit.hexsha[:7],
                        "message": commit.message,
                        "author": commit.author.name,
                        "author_email": commit.author.email,
                        "timestamp": commit.committed_datetime.isoformat(),
                        "committed_date": commit.committed_date,
                        "parent_hashes": [
                            p.hexsha[:7] for p in commit.parents
                        ],
                        "summary": commit.message.split("\n")[0],
                    }
                )
        except Exception as exc:
            logger.warning(
                f"Failed to get file history for {git_path!r}: {exc}"
            )

    # Direct git-tracked file
    _collect(path)
    # DVC pointer file
    _collect(f"{path}.dvc")
    # DVC lock file covers pipeline outputs
    _collect("dvc.lock")

    # Sort newest-first
    commits.sort(key=lambda c: c["committed_date"], reverse=True)
    # Re-deduplicate after merge (committed_date tie-break is irrelevant here
    # but the set already handles correctness).
    seen2: set[str] = set()
    result = []
    for c in commits:
        if c["hash"] not in seen2:
            seen2.add(c["hash"])
            result.append(c)
    return result[:max_count]


def get_commit_history(
    repo: git.Repo, max_count: int = 100
) -> list[dict]:
    """Get detailed commit history for a repository.

    Args:
        repo: GitPython Repo object
        max_count: Maximum number of commits to return

    Returns:
        List of dicts with commit details (hash, message, author, date, etc.)
    """
    commits = []

    try:
        for commit in repo.iter_commits('HEAD', max_count=max_count):
            commits.append({
                "hash": commit.hexsha,
                "short_hash": commit.hexsha[:7],
                "message": commit.message,
                "author": commit.author.name,
                "author_email": commit.author.email,
                "timestamp": commit.committed_datetime.isoformat(),
                "committed_date": commit.committed_date,
                "parent_hashes": [p.hexsha[:7] for p in commit.parents],
                "summary": commit.message.split('\n')[0],
            })
    except Exception as e:
        logger.warning(f"Failed to get commit history: {e}")

    return commits
