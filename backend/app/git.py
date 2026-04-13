"""Functionality for working with Git."""

import atexit
import json
import os
import posixpath
import shutil
import stat
import subprocess
import tempfile
import time
from abc import ABC, abstractmethod
from collections import OrderedDict

import calkit
import git
from fastapi import HTTPException
from filelock import FileLock, Timeout
from git.exc import GitCommandError
from sqlmodel import Session

from app import users
from app.core import logger, ryaml
from app.models import GitRef, Project, User

_SYMLINK_MODE = 0o120000

# Path to a persistent git credential helper script created at first use
# The script reads credentials from GIT_TOKEN / GIT_USER env vars so the
# token never appears in URLs, command-line arguments, or .git/config
_CREDENTIAL_HELPER_PATH: str | None = None


def _get_credential_helper() -> str:
    """Return the path to the git credential helper, creating it if needed."""
    global _CREDENTIAL_HELPER_PATH
    if _CREDENTIAL_HELPER_PATH and os.path.isfile(_CREDENTIAL_HELPER_PATH):
        return _CREDENTIAL_HELPER_PATH
    # Git calls the helper with "get", "store", or "erase" as $1
    # For "get" we read and discard stdin then emit credentials
    # For everything else we drain stdin and do nothing
    script = (
        "#!/bin/sh\n"
        'case "$1" in\n'
        "    get)\n"
        '        while IFS= read -r line; do [ -z "$line" ] && break; done\n'
        '        echo "username=${GIT_USER:-x-access-token}"\n'
        '        echo "password=$GIT_TOKEN"\n'
        "        ;;\n"
        "    *) cat > /dev/null ;;\n"
        "esac\n"
    )
    fd, path = tempfile.mkstemp(prefix="ck_credhelper_", suffix=".sh")
    os.write(fd, script.encode())
    os.close(fd)
    os.chmod(path, stat.S_IRWXU)  # owner-only: rwx------
    atexit.register(lambda: os.path.isfile(path) and os.unlink(path))
    _CREDENTIAL_HELPER_PATH = path
    return path


def _make_git_auth_env(
    token: str, username: str | None = None
) -> dict[str, str]:
    """Return env vars that authenticate any git HTTPS operation.

    Installs a transient credential helper via GIT_CONFIG_COUNT that reads
    from GIT_TOKEN (and optionally GIT_USER). The first config entry clears
    any pre-existing credential helpers so ours is the only one invoked.
    The token never appears in the remote URL, .git/config, or process args.

    Pass ``username`` for hosts that use a fixed git username (e.g. ``"git"``
    for Overleaf); omit it for GitHub where ``x-access-token`` is the default.
    """
    env: dict[str, str] = {
        "GIT_CONFIG_COUNT": "2",
        "GIT_CONFIG_KEY_0": "credential.helper",
        "GIT_CONFIG_VALUE_0": "",  # Clear any existing helpers
        "GIT_CONFIG_KEY_1": "credential.helper",
        "GIT_CONFIG_VALUE_1": f"!{_get_credential_helper()}",
        "GIT_TOKEN": token,
        "GIT_TERMINAL_PROMPT": "0",
    }
    if username is not None:
        env["GIT_USER"] = username
    return env


def get_repo(
    project: Project,
    user: User | None,
    session: Session,
    ttl: int | None = None,
    fresh=False,
    ref: str | None = None,
) -> git.Repo:
    """Ensure that the repo exists and is ready for operating upon for the user.

    Handles concurrency in case multiple API calls request the repo
    simultaneously. If TTL is None, the latest version is always fetched.
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
    access_token: str | None = None
    if user is not None:
        logger.info(f"Getting {user.email}'s access token for Git operations")
        access_token = users.get_github_token(session=session, user=user)
    # Plain URL with no embedded token -- credentials handled in helper
    git_plain_url = project.git_repo_url
    if not git_plain_url.endswith(".git"):
        git_plain_url += ".git"
    newly_cloned = False
    repo = None
    if not os.path.isdir(repo_dir):
        newly_cloned = True
        logger.info(f"Git cloning into {repo_dir}")
        try:
            with lock:
                try:
                    clone_cmd = ["git", "clone", git_plain_url, repo_dir]
                    env = (
                        {**os.environ, **_make_git_auth_env(access_token)}
                        if access_token
                        else None
                    )
                    subprocess.check_call(clone_cmd, env=env)
                except subprocess.CalledProcessError:
                    logger.error("Failed to clone repo")
                    # It's possible another process cloned this repo just as
                    # we were about to, so check again
                    if not os.path.isdir(repo_dir):
                        raise HTTPException(404, "Git repo not found")
                # Touch a file so we can compute a TTL
                subprocess.check_call(["touch", updated_fpath])
                repo = git.Repo(repo_dir)
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
                # Migrate repos cloned with an embedded token in the remote
                # URL to the plain URL so our credential helper is used
                # instead. Plain https URLs from GitHub never contain "@", so
                # this heuristic is safe for our inputs.
                try:
                    current_url = repo.remotes.origin.url
                    if "@" in current_url:
                        logger.info("Stripping token from remote URL")
                        repo.remotes.origin.set_url(git_plain_url)
                except (GitCommandError, AttributeError) as e:
                    # Best-effort migration; log but continue
                    logger.warning(f"Could not migrate remote URL: {e}")
                # Set credentials on the git object before any network ops
                if access_token:
                    repo.git.update_environment(
                        **_make_git_auth_env(access_token)
                    )
                # Unshallow any repo that was cloned with --depth before we
                # switched to always doing full clones.
                try:
                    is_shallow = (
                        repo.git.rev_parse("--is-shallow-repository").strip()
                        == "true"
                    )
                except GitCommandError:
                    is_shallow = os.path.isfile(
                        os.path.join(repo.git_dir, "shallow")
                    )
                if is_shallow:
                    logger.info("Unshallowing legacy shallow repo")
                    repo.git.fetch(["--unshallow", "--tags"])
                    subprocess.call(["touch", updated_fpath])
                ttl_expired = ttl is None or (
                    (time.time() - last_updated) > ttl
                )
                if ttl_expired and not is_shallow:
                    logger.info("Git fetching")
                    if ref is None:
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
    # Attach credentials to the repo's git runner so every subsequent
    # push/fetch/pull in callers (routes/core.py etc.) is authenticated
    # without embedding the token in any URL or argument
    if access_token:
        repo.git.update_environment(**_make_git_auth_env(access_token))
    # Always (re)configure committer identity. Do this on every call because
    # `user.full_name` may have been None at the time of the initial clone
    # (GitHub users without a display name), which would have stored the
    # literal string "None" as the committer
    if user is not None:
        _configure_committer(repo, user, session=session)
    return repo


def _detect_full_name_from_history(repo: git.Repo, email: str) -> str | None:
    """Look for a prior commit by ``email`` with a usable author name.

    Returns the first non-empty name that isn't the literal "None" (which is
    what a ``None`` ``user.full_name`` got stringified to in earlier commits).
    """
    if not email:
        return None
    try:
        out = repo.git.log(
            "--all",
            f"--author={email}",
            "--pretty=%an",
            "-n",
            "50",
        )
    except GitCommandError:
        return None
    for line in out.splitlines():
        candidate = line.strip()
        if candidate and candidate.lower() != "none":
            return candidate
    return None


def _configure_committer(
    repo: git.Repo, user: User, session: Session | None = None
) -> None:
    """Set the repo's user.name/user.email so commits are authored correctly.

    If ``user.full_name`` is missing, tries to recover a real name from the
    repo's own history (prior commits by the same email) and persists it back
    to the User row. Falls back through ``full_name`` -> ``github_username``
    -> ``email`` so we never pass ``None`` (which GitPython would stringify
    to "None").
    """
    email = user.email or f"{user.github_username}@users.noreply.github.com"
    if not user.full_name and session is not None:
        detected = _detect_full_name_from_history(repo, email)
        if detected:
            logger.info(
                f"Recovered full_name '{detected}' for {user.email} "
                "from repo history"
            )
            user.full_name = detected
            session.add(user)
            session.commit()
    name = user.full_name or user.github_username or user.email
    repo.git.config(["user.name", name])
    repo.git.config(["user.email", email])


def get_zip_path_map_from_repo(repo: git.Repo) -> dict:
    """Return the dvc-zip workspace→zip path map from .calkit/zip/paths.json."""
    paths_json = os.path.join(repo.working_dir, ".calkit", "zip", "paths.json")
    if not os.path.isfile(paths_json):
        return {}
    try:
        with open(paths_json) as f:
            return json.load(f) or {}
    except Exception:
        return {}


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
    owner_name, project_name = project.owner_github_name, project.name
    base_dir = (
        f"/tmp/{user.github_username}/{owner_name}/"
        f"{project_name}/overleaf/{overleaf_project_id}"
    )
    repo_dir = os.path.join(base_dir, "repo")
    os.makedirs(base_dir, exist_ok=True)
    overleaf_token = users.get_overleaf_token(session=session, user=user)
    # Plain URL — credentials supplied via credential helper
    # (username "git" for Overleaf)
    git_plain_url = f"https://git.overleaf.com/{overleaf_project_id}"
    overleaf_auth = _make_git_auth_env(overleaf_token, username="git")
    if os.path.isdir(repo_dir):
        repo = git.Repo(repo_dir)
        repo.git.update_environment(**overleaf_auth)
        repo.git.pull()
    else:
        subprocess.check_call(
            ["git", "clone", git_plain_url, repo_dir],
            env={**os.environ, **overleaf_auth},
        )
        repo = git.Repo(repo_dir)
        repo.git.update_environment(**overleaf_auth)
    # Run git config so we make commits as this user (with safe fallbacks)
    _configure_committer(repo, user, session=session)
    return repo


def get_default_branch(repo: git.Repo) -> str:
    """Return the default branch name (e.g. 'main' or 'master')."""
    try:
        # origin/HEAD symbolic ref is the most reliable source
        origin_head = repo.remotes.origin.refs["HEAD"]
        ref_path = origin_head.ref.name  # e.g. "origin/main"
        return ref_path.removeprefix("origin/")
    except Exception:
        pass
    # Fall back: look for common default names
    branch_names = {b.name for b in repo.branches}
    for candidate in ("main", "master", "trunk", "develop"):
        if candidate in branch_names:
            return candidate
    # Last resort: use whatever HEAD points to
    try:
        return repo.active_branch.name
    except Exception:
        return "main"


def _ahead_behind(
    repo: git.Repo, branch_ref: str, base_ref: str
) -> tuple[int, int]:
    """Return (ahead, behind) commit counts of branch_ref vs base_ref."""
    try:
        ahead = sum(
            1
            for _ in repo.iter_commits(
                f"{base_ref}..{branch_ref}", max_count=200
            )
        )
        behind = sum(
            1
            for _ in repo.iter_commits(
                f"{branch_ref}..{base_ref}", max_count=200
            )
        )
        return ahead, behind
    except Exception:
        return 0, 0


def search_refs(repo: git.Repo, query: str | None = None) -> list["GitRef"]:
    """Search for refs (branches, tags, commits) in a repository.

    Parameters
    ----------
    repo : git.Repo
        GitPython Repo object.
    query : str, optional
        Filter by branch name, tag name, commit message, or author name.

    Returns
    -------
    list[GitRef]
        Refs with name, type, message, author, timestamp.
    """
    refs = []
    query_lower = query.lower() if query else None

    default_branch = get_default_branch(repo)

    # Add branches--prefer remote refs so shallow clones see all branches
    seen_branches: set[str] = set()
    try:
        remote_refs = list(repo.remotes.origin.refs)
    except Exception:
        remote_refs = []
    branch_sources = [
        (ref.name.removeprefix("origin/"), ref)
        for ref in remote_refs
        if not ref.name.endswith("/HEAD")
    ] + [
        (branch.name, branch)
        for branch in repo.branches
        if branch.name
        not in {
            r.name.removeprefix("origin/")
            for r in remote_refs
            if not r.name.endswith("/HEAD")
        }
    ]
    for name, ref in branch_sources:
        if name in seen_branches:
            continue
        seen_branches.add(name)
        if query_lower and query_lower not in name.lower():
            try:
                commit = ref.commit
                msg = (
                    commit.message
                    if isinstance(commit.message, str)
                    else bytes(commit.message).decode()
                )
                if (
                    query_lower not in msg.lower()
                    and query_lower not in (commit.author.name or "").lower()
                ):
                    continue
            except Exception:
                continue
        try:
            commit = ref.commit
            msg = (
                commit.message
                if isinstance(commit.message, str)
                else bytes(commit.message).decode()
            )
            is_default = name == default_branch
            ahead, behind = (
                (0, 0)
                if is_default
                else _ahead_behind(repo, name, default_branch)
            )
            refs.append(
                {
                    "name": name,
                    "kind": "branch",
                    "message": msg.split("\n")[0],
                    "author": commit.author.name,
                    "timestamp": commit.committed_datetime.isoformat(),
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:7],
                    "is_default": is_default,
                    "ahead": ahead,
                    "behind": behind,
                }
            )
        except Exception as e:
            logger.warning(f"Failed to get commit info for branch {name}: {e}")
            refs.append(
                {
                    "name": name,
                    "kind": "branch",
                    "is_default": name == default_branch,
                    "ahead": 0,
                    "behind": 0,
                }
            )

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
                except Exception:
                    pass

            try:
                commit = tag.commit
                message = None
                if tag.tag and tag.tag.message:
                    message = tag.tag.message.split("\n")[0]
                elif commit.message:
                    raw = commit.message
                    msg_str = (
                        raw if isinstance(raw, str) else bytes(raw).decode()
                    )
                    message = msg_str.split("\n")[0]

                refs.append(
                    {
                        "name": name,
                        "kind": "tag",
                        "message": message,
                        "author": commit.author.name
                        if commit.author
                        else None,
                        "timestamp": commit.committed_datetime.isoformat()
                        if commit.committed_datetime
                        else None,
                        "hash": commit.hexsha,
                        "short_hash": commit.hexsha[:7],
                    }
                )
            except Exception as e:
                logger.warning(
                    f"Failed to get commit info for tag {name}: {e}"
                )
                refs.append(
                    {
                        "name": name,
                        "kind": "tag",
                    }
                )
    except Exception as e:
        logger.warning(f"Failed to list tags: {e}")

    # Add recent commits
    try:
        max_commits = 50
        for commit in repo.iter_commits("HEAD", max_count=max_commits):
            short_hash = commit.hexsha[:7]
            raw_msg = commit.message
            message = (
                (
                    raw_msg
                    if isinstance(raw_msg, str)
                    else bytes(raw_msg).decode()
                ).split("\n")[0]
                if raw_msg
                else ""
            )
            # Check if this commit matches the query
            if query_lower:
                if not (
                    query_lower in short_hash.lower()
                    or query_lower in message.lower()
                    or query_lower in (commit.author.name or "").lower()
                ):
                    continue
            # Avoid duplicates with branches/tags
            if short_hash not in [r.get("short_hash", "") for r in refs]:
                refs.append(
                    {
                        "name": short_hash,
                        "kind": "commit",
                        "message": message,
                        "author": commit.author.name,
                        "timestamp": commit.committed_datetime.isoformat(),
                        "hash": commit.hexsha,
                        "short_hash": short_hash,
                    }
                )
    except Exception as e:
        logger.warning(f"Failed to list commits: {e}")
    # Sort refs: branches first, then tags, then commits; newest first in each
    kind_order = {"branch": 0, "tag": 1, "commit": 2}
    refs.sort(
        key=lambda r: (
            kind_order.get(r.get("kind", "commit"), 3),
            r.get("timestamp") or "",
            r.get("name") or "",
        ),
        reverse=False,
    )
    refs.sort(key=lambda r: r.get("timestamp") or "", reverse=True)
    refs.sort(
        key=lambda r: kind_order.get(r.get("kind", "commit"), 3),
        reverse=False,
    )
    return [GitRef(**r) for r in refs]


# Cache for get_file_history results, keyed by (repo_dir, path, max_count,
# head_sha)
# Bounded to 256 entries; keyed by HEAD SHA so stale entries are never
# returned
_FILE_HISTORY_CACHE: OrderedDict[tuple, list[dict]] = OrderedDict()
_FILE_HISTORY_CACHE_MAX = 256

# Cache of parsed dvc.lock blobs: {blob_sha: {out_path: md5}}.
# Shared across all file-history requests in the process so the YAML parse
# for any given dvc.lock revision only happens once.
_DVC_LOCK_PARSE_CACHE: OrderedDict[str, dict[str, str]] = OrderedDict()
_DVC_LOCK_PARSE_CACHE_MAX = 512


def _dvc_lock_outs_at(commit: git.Commit) -> dict[str, str] | None:
    """Return the {out_path: md5} map parsed from dvc.lock at ``commit``.

    Caches by dvc.lock blob SHA so the same revision is never parsed twice,
    even across different file-history requests.
    """
    try:
        blob = commit.tree / "dvc.lock"
    except KeyError:
        return None
    sha = blob.hexsha
    cached = _DVC_LOCK_PARSE_CACHE.get(sha)
    if cached is not None:
        _DVC_LOCK_PARSE_CACHE.move_to_end(sha)
        return cached
    try:
        data = ryaml.load(blob.data_stream.read()) or {}
    except Exception:
        data = {}
    outs: dict[str, str] = {}
    for stage in (data.get("stages") or {}).values():
        for out in stage.get("outs") or []:
            p = out.get("path")
            if not p:
                continue
            outs[p] = out.get("md5") or out.get("hash") or ""
    _DVC_LOCK_PARSE_CACHE[sha] = outs
    if len(_DVC_LOCK_PARSE_CACHE) > _DVC_LOCK_PARSE_CACHE_MAX:
        _DVC_LOCK_PARSE_CACHE.popitem(last=False)
    return outs


def _commit_to_dict(commit: git.Commit) -> dict:
    msg = (
        commit.message
        if isinstance(commit.message, str)
        else bytes(commit.message).decode()
    )
    return {
        "hash": commit.hexsha,
        "short_hash": commit.hexsha[:7],
        "message": msg,
        "author": commit.author.name,
        "author_email": commit.author.email,
        "timestamp": commit.committed_datetime.isoformat(),
        "committed_date": commit.committed_date,
        "parent_hashes": [p.hexsha[:7] for p in commit.parents],
        "summary": msg.split("\n")[0],
    }


def get_file_history(
    repo: git.Repo,
    path: str,
    max_count: int = 100,
    storage: str | None = None,
) -> list[dict]:
    """Get commit history for a specific file path.

    Checks only the sources relevant to the artifact's ``storage`` class:

    - ``git``: only commits that touched the file itself.
    - ``dvc``: the file (legacy/pre-DVC history), the ``<path>.dvc`` pointer,
      and ``dvc.lock`` transitions for pipeline outputs.
    - ``dvc-zip``: the ``<path>.dvc`` pointer and ``dvc.lock``.
    - ``None`` (unknown): check everything — preserves the legacy behaviour.

    The ``dvc.lock`` scan only counts commits where *this* path's md5
    actually changed, and YAML parses are cached by blob SHA across all
    file-history requests.

    Parameters
    ----------
    repo : git.Repo
        GitPython Repo object.
    path : str
        Repo-relative file path to look up.
    max_count : int
        Maximum number of commits to return.
    storage : str, optional
        One of ``"git"``, ``"dvc"``, ``"dvc-zip"``. Used to skip lookups
        that can't possibly produce results for this artifact.

    Returns
    -------
    list[dict]
        Commit dicts sorted newest-first.
    """
    head_sha = repo.head.commit.hexsha
    cache_key = (repo.working_dir, path, max_count, storage, head_sha)
    if cache_key in _FILE_HISTORY_CACHE:
        logger.info(f"Cache hit for file history: {path}")
        _FILE_HISTORY_CACHE.move_to_end(cache_key)
        return _FILE_HISTORY_CACHE[cache_key]

    check_file = storage in (None, "git", "dvc")
    check_dvc_pointer = storage in (None, "dvc", "dvc-zip")
    check_dvc_lock = storage in (None, "dvc", "dvc-zip")

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
                commits.append(_commit_to_dict(commit))
        except Exception as exc:
            logger.warning(
                f"Failed to get file history for {git_path!r}: {exc}"
            )

    if check_file:
        _collect(path)
    if check_dvc_pointer:
        _collect(f"{path}.dvc")
    if check_dvc_lock:
        try:
            prev_hash: str | None = None
            for commit in repo.iter_commits(
                "HEAD", paths="dvc.lock", max_count=max_count * 4
            ):
                outs = _dvc_lock_outs_at(commit)
                current_hash = outs.get(path) if outs else None
                if current_hash and current_hash != prev_hash:
                    if commit.hexsha not in seen:
                        seen.add(commit.hexsha)
                        commits.append(_commit_to_dict(commit))
                if current_hash:
                    prev_hash = current_hash
        except Exception as exc:
            logger.warning(
                f"Failed to get dvc.lock history for {path!r}: {exc}"
            )

    commits.sort(key=lambda c: c["committed_date"], reverse=True)
    result = commits[:max_count]
    _FILE_HISTORY_CACHE[cache_key] = result
    if len(_FILE_HISTORY_CACHE) > _FILE_HISTORY_CACHE_MAX:
        _FILE_HISTORY_CACHE.popitem(last=False)
    return result


def get_commit_history(
    repo: git.Repo, max_count: int = 100, ref: str | None = None
) -> list[dict]:
    """Get detailed commit history for a repository.

    Parameters
    ----------
    repo : git.Repo
        GitPython Repo object.
    max_count : int
        Maximum number of commits to return.
    ref : str, optional
        Branch, tag, or commit to start from (defaults to HEAD).

    Returns
    -------
    list[dict]
        Commit dicts with hash, message, author, date, etc.
    """
    commits = []
    start = ref if ref else "HEAD"

    # If the ref doesn't exist locally, try the remote tracking branch
    candidates = [start]
    if ref:
        candidates.append(f"origin/{ref}")
    for candidate in candidates:
        try:
            for commit in repo.iter_commits(candidate, max_count=max_count):
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
                        "summary": (
                            commit.message
                            if isinstance(commit.message, str)
                            else bytes(commit.message).decode()
                        ).split("\n")[0],
                    }
                )
            break
        except Exception as e:
            logger.warning(
                f"Failed to get commit history for {candidate}: {e}"
            )

    return commits


class RepoTree(ABC):
    """Read-only, path-based view over a set of files in a repository.

    ``WorkingTree`` and ``GitTree`` are the two concrete implementations.
    Adding a third (e.g., a bare-repo or remote-object-store backend) only
    requires subclassing here--callers need not change.
    """

    @abstractmethod
    def exists(self, path: str) -> bool: ...

    @abstractmethod
    def is_file(self, path: str) -> bool: ...

    @abstractmethod
    def is_dir(self, path: str | None) -> bool: ...

    @abstractmethod
    def is_symlink(self, path: str) -> bool: ...

    @abstractmethod
    def is_safe_symlink(self, path: str) -> bool:
        """True if the symlink at *path* resolves within this tree."""
        ...

    @abstractmethod
    def read_bytes(self, path: str) -> bytes: ...

    def read_text(self, path: str, encoding: str = "utf-8") -> str:
        return self.read_bytes(path).decode(encoding)

    @abstractmethod
    def size(self, path: str) -> int: ...

    @abstractmethod
    def listdir(self, path: str | None) -> list[str]:
        """Immediate child names (not full paths) under *path*; None = root."""
        ...


class WorkingTree(RepoTree):
    """RepoTree backed by a live filesystem checkout."""

    def __init__(self, root: str) -> None:
        self._root = root

    def _abs(self, path: str | None) -> str:
        return self._root if not path else os.path.join(self._root, path)

    def exists(self, path: str) -> bool:
        return os.path.exists(self._abs(path))

    def is_file(self, path: str) -> bool:
        return os.path.isfile(self._abs(path))

    def is_dir(self, path: str | None) -> bool:
        return os.path.isdir(self._abs(path))

    def is_symlink(self, path: str) -> bool:
        return os.path.islink(self._abs(path))

    def is_safe_symlink(self, path: str) -> bool:
        try:
            resolved = os.path.realpath(self._abs(path))
            root_real = os.path.realpath(self._root)
            return (
                resolved.startswith(root_real + os.sep)
                or resolved == root_real
            )
        except (OSError, ValueError):
            return False

    def read_bytes(self, path: str) -> bytes:
        with open(self._abs(path), "rb") as f:
            return f.read()

    def size(self, path: str) -> int:
        return os.path.getsize(self._abs(path))

    def listdir(self, path: str | None) -> list[str]:
        return os.listdir(self._abs(path))


class GitTree(RepoTree):
    """RepoTree that reads directly from git's object database.

    No working-tree checkout required--file content streams straight from
    blob objects. Suitable for browsing any historical ref without touching
    the filesystem beyond the git object store.
    """

    def __init__(self, repo: git.Repo, ref: str) -> None:
        self._git_tree = _resolve_commit(repo, ref).tree

    def _get(self, path: str) -> git.Blob | git.Tree:
        try:
            return self._git_tree[path]  # type: ignore[return-value]
        except KeyError:
            raise KeyError(path)

    def exists(self, path: str) -> bool:
        try:
            self._get(path)
            return True
        except KeyError:
            return False

    def is_file(self, path: str) -> bool:
        try:
            e = self._get(path)
            return isinstance(e, git.Blob) and e.mode != _SYMLINK_MODE
        except KeyError:
            return False

    def is_dir(self, path: str | None) -> bool:
        if not path:
            return True  # root is always a tree
        try:
            return isinstance(self._get(path), git.Tree)
        except KeyError:
            return False

    def is_symlink(self, path: str) -> bool:
        try:
            e = self._get(path)
            return isinstance(e, git.Blob) and e.mode == _SYMLINK_MODE
        except KeyError:
            return False

    def is_safe_symlink(self, path: str) -> bool:
        try:
            e = self._get(path)
            if not isinstance(e, git.Blob) or e.mode != _SYMLINK_MODE:
                return False
            target = e.data_stream.read().decode()
            parent = posixpath.dirname(path)
            resolved = posixpath.normpath(posixpath.join(parent, target))
            return not resolved.startswith("..") and not posixpath.isabs(
                resolved
            )
        except Exception:
            return False

    def read_bytes(self, path: str) -> bytes:
        return self._get(path).data_stream.read()

    def size(self, path: str) -> int:
        return self._get(path).size

    def listdir(self, path: str | None) -> list[str]:
        t = self._git_tree if not path else self._get(path)
        if not isinstance(t, git.Tree):
            raise NotADirectoryError(path)
        return [item.name for item in t]


def _resolve_commit(repo: git.Repo, ref: str) -> git.Commit:
    """Resolve a branch, tag, or commit hash to a Commit object."""
    for candidate in (ref, f"origin/{ref}"):
        try:
            return repo.commit(candidate)
        except Exception:
            continue
    raise HTTPException(404, f"Git ref '{ref}' was not found")


def get_repo_tree_for_ref(repo: git.Repo, ref: str | None) -> RepoTree:
    """Return a ``RepoTree`` for *ref*.

    ``None`` returns a ``WorkingTree`` over the live checkout.  Any other
    value returns a ``GitTree`` that reads straight from the object database
    with no filesystem extraction.
    """
    if ref is None:
        return WorkingTree(str(repo.working_dir))
    if not ref or ref.startswith("-") or any(c in ref for c in " \t\n\r\x00"):
        raise HTTPException(400, f"Invalid Git ref: {ref!r}")
    return GitTree(repo, ref)
