"""Functionality for working with projects"""

import base64
import hashlib
import json
import logging
import os
from typing import Literal

import git
import requests
import sqlalchemy
import yaml
from calkit.notebooks import get_executed_notebook_path
from fastapi import HTTPException
from sqlmodel import Session, select

import app.users
from app.config import settings
from app.git import RepoTree, get_repo_tree_for_ref
from app.core import CATEGORIES_PLURAL_TO_SINGULAR, params_from_url
from app.dvc import expand_dvc_lock_outs
from app.dvc import get_data_fpath_for_md5
from app.git import get_ck_info_from_repo, get_zip_path_map_from_repo
from app.models import (
    ContentsItem,
    Figure,
    ItemLock,
    Notebook,
    Org,
    Project,
    Publication,
    User,
    UserProjectAccess,
)
from app.storage import (
    get_object_fs,
    get_object_url,
    make_data_fpath,
    remove_gcs_content_type,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RETURN_CONTENT_SIZE_LIMIT = 1_000_000


def get_project(
    session: Session,
    owner_name: str,
    project_name: str,
    if_not_exists: Literal["ignore", "error"] = "error",
    current_user: User | None = None,
    min_access_level: Literal["read", "write", "admin", "owner"] | None = None,
) -> Project:
    """Fetch a project by owner and name."""
    if current_user is None:
        user_name = "anonymous"
    else:
        user_name = current_user.email
    logger.info(
        f"Fetching project {owner_name}/{project_name} for {user_name}"
    )
    query = (
        select(Project)
        .where(Project.owner_account.has(name=owner_name.lower()))
        .where(sqlalchemy.func.lower(Project.name) == project_name.lower())
    )
    project = session.exec(query).first()
    if project is None and if_not_exists == "error":
        logger.info(f"Project {owner_name}/{project_name} does not exist")
        raise HTTPException(404)
    if (
        min_access_level is not None
        and current_user is None
        and not project.is_public
    ):
        raise HTTPException(403, "User is not authenticated")
    if current_user is None and project.is_public:
        project.current_user_access = "read"
    elif current_user is not None:
        # Compute access
        if project.owner == current_user:
            project.current_user_access = "owner"
        elif isinstance(project.owner, Org):
            # Only give access to org owners and admins for now
            # TODO: Allow more fine-grained access
            for org_membership in current_user.org_memberships:
                if (
                    org_membership.org_id == project.owner.account.org_id
                    and org_membership.role_name in ["admin", "owner"]
                ):
                    project.current_user_access = "owner"
                    break
            if project.current_user_access is None and project.is_public:
                project.current_user_access = "read"
        else:
            # Query for permissions in our database, and if they aren't set,
            # query GitHub and save
            # TODO: We seem to have a race condition here with multiple
            # requests causing this to run concurrently, though it doesn't
            # seem to actually cause a problem despite the failure to write
            # to the database in all but one
            access_query = (
                select(UserProjectAccess)
                .where(UserProjectAccess.project_id == project.id)
                .where(UserProjectAccess.user_id == current_user.id)
                .with_for_update()
            )
            access = session.exec(access_query).first()
            if access is not None:
                project.current_user_access = access.access
            else:
                # Query GitHub for permissions
                try:
                    github_token = app.users.get_github_token(
                        session, current_user
                    )
                except HTTPException:
                    github_token = None
                    logger.info(
                        f"User {current_user.email} has no GitHub token"
                    )
                if github_token is not None:
                    logger.info("Fetching permissions from GitHub")
                    url = (
                        f"https://api.github.com/repos/{project.github_repo}"
                        f"/collaborators/{current_user.github_username}/"
                        "permission"
                    )
                    resp = requests.get(
                        url,
                        headers={"Authorization": f"Bearer {github_token}"},
                    )
                    if resp.status_code == 200:
                        logger.info("Fetched permissions from GitHub")
                        permissions = resp.json()["permission"]
                        if permissions == "none":
                            permissions = None
                    else:
                        permissions = None
                        logger.info(
                            "Failed to fetch permissions from GitHub "
                            f"({resp.status_code})"
                        )
                    project.current_user_access = permissions
                    session.add(
                        UserProjectAccess(
                            project_id=project.id,
                            user_id=current_user.id,
                            access=permissions,
                        )
                    )
                    session.commit()
        if project.is_public and project.current_user_access is None:
            project.current_user_access = "read"
        if project.current_user_access is None:
            raise HTTPException(403)
        access_levels = {
            level: n
            for (n, level) in enumerate(["read", "write", "admin", "owner"])
        }
        user_has_level = access_levels[project.current_user_access]
        min_level = access_levels[min_access_level]
        if user_has_level < min_level:
            raise HTTPException(403)
    return project


def get_contents_from_repo(
    project: Project,
    repo: git.Repo,
    path: str | None = None,
    ref: str | None = None,
) -> ContentsItem:
    return get_contents_from_tree(
        project=project,
        tree=get_repo_tree_for_ref(repo, ref),
        path=path,
    )


def get_ck_info_and_dvc_outs_from_tree(
    project: Project,
    tree: RepoTree,
) -> tuple[dict, dict, dict]:
    """Load calkit.yaml and expand dvc.lock outs once for a tree.

    Returns (ck_info, dvc_lock_outs, zip_path_map). zip_path_map maps
    workspace paths to their zip file path (e.g. {"data/mydir":
    ".calkit/zip/files/data/mydir.zip"}). Callers that read multiple paths
    from the same tree should call this once and pass the results to
    get_contents_from_tree to avoid redundant I/O.
    """
    owner_name = project.owner_account_name
    project_name = project.name
    if tree.is_file("calkit.yaml"):
        logger.info("Loading calkit.yaml")
        ck_info = yaml.safe_load(tree.read_text("calkit.yaml")) or {}
    else:
        ck_info = {}
    dvc_lock = {}
    if tree.is_file("dvc.lock"):
        logger.info("Reading dvc.lock")
        dvc_lock = yaml.safe_load(tree.read_text("dvc.lock")) or {}
    logger.info("Expanding DVC lock outs")
    fs = get_object_fs()
    dvc_lock_outs = expand_dvc_lock_outs(
        dvc_lock, owner_name=owner_name, project_name=project_name, fs=fs
    )
    zip_path_map: dict = {}
    zip_paths_json = ".calkit/zip/paths.json"
    if tree.is_file(zip_paths_json):
        logger.info("Reading .calkit/zip/paths.json")
        try:
            zip_path_map = json.loads(tree.read_text(zip_paths_json)) or {}
        except Exception:
            logger.warning("Failed to parse .calkit/zip/paths.json")
    return ck_info, dvc_lock_outs, zip_path_map


def get_contents_from_tree(
    project: Project,
    tree: RepoTree,
    path: str | None = None,
    ck_info: dict | None = None,
    dvc_lock_outs: dict | None = None,
    zip_path_map: dict | None = None,
) -> ContentsItem:
    owner_name = project.owner_account_name
    project_name = project.name
    # Prevent path traversal attacks
    if path is not None:
        if os.path.isabs(path):
            raise HTTPException(400, "Absolute paths are not allowed")
        if ".." in path.split(os.sep):
            raise HTTPException(400, "Path traversal is not allowed")
    # Reject unsafe symlinks
    if path is not None and tree.is_symlink(path):
        if not tree.is_safe_symlink(path):
            logger.warning(
                f"Unsafe symlink detected in {owner_name}/{project_name} "
                f"at {path}"
            )
            raise HTTPException(404)
    # Load calkit.yaml and dvc.lock outs if not pre-computed by the caller
    if ck_info is None or dvc_lock_outs is None or zip_path_map is None:
        ck_info, dvc_lock_outs, zip_path_map = (
            get_ck_info_and_dvc_outs_from_tree(project, tree)
        )
    fs = get_object_fs()
    dvc_lock_out_dirs = [
        p for p, obj in dvc_lock_outs.items() if obj["type"] == "dir"
    ]
    ignore_paths = [".git", ".dvc/cache", ".dvc/tmp", ".dvc/config.local"]
    if path is not None and path in ignore_paths:
        raise HTTPException(404)
    # Let's restructure as a dictionary keyed by path
    categories_with_path = [
        "figures",
        "publications",
        "datasets",
        "references",
        "notebooks",
    ]
    ck_objects = {}
    for category, itemlist in ck_info.items():
        if category not in categories_with_path:
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
        if p in dvc_lock_outs:
            ck_outs[p] = dvc_lock_outs[p]
        else:
            dvc_fp = p + ".dvc"
            if tree.is_file(dvc_fp):
                dvo = yaml.safe_load(tree.read_text(dvc_fp))["outs"][0]
                ck_outs[p] = dvo
            else:
                ck_outs[p] = None
    file_locks_by_path = {
        lock.path: ItemLock.model_validate(lock.model_dump())
        for lock in project.file_locks
    }
    # Build reverse map: zip_path -> workspace_path (for size lookup)
    zip_workspace_paths = set(zip_path_map.keys())
    # See if we're listing off a directory
    if path is None or tree.is_dir(path) or path in dvc_lock_out_dirs:
        logger.info(f"Getting contents of directory: {path}")
        dirname = "" if path is None else path
        contents = []
        if path not in dvc_lock_out_dirs:
            child_names = sorted(tree.listdir(path or None))
            paths = [os.path.join(dirname, n) for n in child_names]
        else:
            paths = []
        dvc_paths = [
            p for p, obj in dvc_lock_outs.items() if obj["dirname"] == dirname
        ]
        all_paths = sorted(set(paths + dvc_paths))
        for p in all_paths:
            if p in ignore_paths:
                continue
            in_repo = tree.exists(p)
            if in_repo:
                size = tree.size(p)
                obj_type = "file" if tree.is_file(p) else "dir"
                storage: str | None = "git"
            elif p in dvc_lock_outs:
                size = dvc_lock_outs[p].get("size")
                obj_type = dvc_lock_outs[p]["type"]
                storage = "dvc"
            else:
                storage = None
            obj = dict(
                name=os.path.basename(p),
                path=p,
                size=size,
                in_repo=in_repo,
                lock=file_locks_by_path.get(p),
                type=obj_type,
                calkit_object=ck_objects.get(p),
                storage=storage,
            )
            contents.append(ContentsItem.model_validate(obj))
        for ck_path, ck_obj in ck_objects.items():
            if (
                os.path.dirname(ck_path) == dirname
                and ck_path not in all_paths
            ):
                dvc_out = ck_outs.get(ck_path) or {}
                contents.append(
                    ContentsItem.model_validate(
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
                            storage="dvc",
                        )
                    )
                )
        # Add virtual entries for dvc-zip mapped workspace paths
        existing_paths = {c.path for c in contents}
        for ws_path, zip_path in zip_path_map.items():
            if os.path.dirname(ws_path) != dirname:
                continue
            if ws_path in existing_paths:
                # Already present (e.g. unzipped in working tree); update storage
                for c in contents:
                    if c.path == ws_path:
                        c.storage = "dvc-zip"
                continue
            # Get size from the zip's .dvc pointer file
            size = None
            dvc_pointer = zip_path + ".dvc"
            if tree.is_file(dvc_pointer):
                try:
                    dvc_out = yaml.safe_load(tree.read_text(dvc_pointer))
                    size = dvc_out.get("outs", [{}])[0].get("size")
                except Exception:
                    pass
            contents.append(
                ContentsItem.model_validate(
                    dict(
                        name=os.path.basename(ws_path),
                        path=ws_path,
                        in_repo=False,
                        size=size,
                        type="dir",
                        calkit_object=ck_objects.get(ws_path),
                        lock=file_locks_by_path.get(ws_path),
                        storage="dvc-zip",
                    )
                )
            )
        contents.sort(key=lambda c: c.path)
        return ContentsItem(
            name=os.path.basename(dirname),
            path=dirname,
            type="dir",
            size=sum(c.size or 0 for c in contents),
            dir_items=contents,
            calkit_object=ck_objects.get(path),
            in_repo=tree.is_dir(dirname or None),
        )
    # We're looking for a file
    if tree.is_file(path):
        size = tree.size(path)
        url = None
        content = tree.read_bytes(path)
        if size > RETURN_CONTENT_SIZE_LIMIT:
            logger.info(f"{path} is greater than return size limit")
            md5 = hashlib.md5(content).hexdigest()
            fp = make_data_fpath(
                owner_name=owner_name,
                project_name=project_name,
                idx=md5[:2],
                md5=md5[2:],
            )
            if not fs.isfile(fp):
                logger.info(f"Writing {path} to object storage")
                with fs.open(fp, "wb") as f:
                    f.write(content)
                if settings.ENVIRONMENT != "local":
                    remove_gcs_content_type(fp)
            url = get_object_url(fp, fname=os.path.basename(path), fs=fs)
            content = None
        return ContentsItem.model_validate(
            dict(
                path=path,
                name=os.path.basename(path),
                size=size,
                type="file",
                in_repo=True,
                content=(
                    base64.b64encode(content).decode()
                    if content is not None
                    else None
                ),
                calkit_object=ck_objects.get(path),
                lock=file_locks_by_path.get(path),
                url=url,
                storage="git",
            )
        )
    elif path in zip_workspace_paths:
        # dvc-zip mapped directory. Must take precedence over the
        # ck_objects branch below, since a dvc-zip workspace path may
        # also be registered as a dataset/publication artifact and
        # should still be labeled with its dvc-zip storage.
        zip_path = zip_path_map[path]
        dvc_pointer = zip_path + ".dvc"
        size = None
        if tree.is_file(dvc_pointer):
            try:
                dvc_out_data = yaml.safe_load(tree.read_text(dvc_pointer))
                size = dvc_out_data.get("outs", [{}])[0].get("size")
            except Exception:
                pass
        return ContentsItem.model_validate(
            dict(
                path=path,
                name=os.path.basename(path),
                size=size,
                type="dir",
                in_repo=False,
                calkit_object=ck_objects.get(path),
                lock=file_locks_by_path.get(path),
                storage="dvc-zip",
            )
        )
    elif path in ck_objects:
        logger.info(f"Looking in CK objects for {path}")
        dvc_out = ck_outs.get(path) or {}
        size = dvc_out.get("size")
        md5 = dvc_out.get("md5", "")
        dvc_fpath = dvc_out.get("path")
        dvc_type = "dir" if md5.endswith(".dir") else "file"
        content = None
        url = None
        if md5:
            fp = get_data_fpath_for_md5(
                owner_name=owner_name,
                project_name=project_name,
                md5=md5,
                fs=fs,
            )
            if fp is not None:
                url = get_object_url(
                    fp, fname=os.path.basename(dvc_fpath), fs=fs
                )
            if (
                size is not None
                and size <= RETURN_CONTENT_SIZE_LIMIT
                and fp is not None
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
                storage="dvc",
            )
        )
    else:
        # Do we have a DVC file for this path?
        dvc_pointer = path + ".dvc"
        if path in dvc_lock_outs or tree.is_file(dvc_pointer):
            if tree.is_file(dvc_pointer):
                dvc_out = yaml.load(tree.read_text(dvc_pointer))["outs"][0]
            else:
                dvc_out = dvc_lock_outs[path]
            md5 = dvc_out["md5"]
            fp = get_data_fpath_for_md5(
                owner_name=owner_name,
                project_name=project_name,
                md5=md5,
                fs=fs,
            )
            url = (
                get_object_url(fp, fname=os.path.basename(path), fs=fs)
                if fp
                else None
            )
            size = dvc_out.get("size")
            dvc_type = "dir" if md5.endswith(".dir") else "file"
            # TODO: If this is a directory, list dir_items
            return ContentsItem.model_validate(
                dict(
                    path=path,
                    name=os.path.basename(path),
                    size=size,
                    type=dvc_type,
                    in_repo=False,
                    url=url,
                    lock=file_locks_by_path.get(path),
                    storage="dvc",
                )
            )
        raise HTTPException(404)


def get_ck_info_for_ref(
    project: Project,
    repo: git.Repo,
    ref: str | None = None,
    process_includes: bool = False,
) -> dict:
    """Return Calkit metadata for the requested ref, if provided."""
    if ref is None:
        return get_ck_info_from_repo(
            repo=repo,
            process_includes=process_includes,
        )
    ck_item = get_contents_from_repo(
        project=project,
        repo=repo,
        path="calkit.yaml",
        ref=ref,
    )
    if ck_item.content is None:
        return {}
    ck_info = yaml.safe_load(base64.b64decode(ck_item.content))
    if ck_info is None:
        return {}
    return ck_info


def get_figure_from_repo(
    project: Project,
    repo: git.Repo,
    path: str,
    ref: str | None = None,
) -> Figure:
    ck_info = get_ck_info_for_ref(project=project, repo=repo, ref=ref)
    figures = ck_info.get("figures", [])
    # Get the figure content (will be base64-encoded)
    for fig in figures:
        if fig.get("path") == path:
            item = get_contents_from_repo(
                project=project,
                repo=repo,
                path=fig["path"],
                ref=ref,
            )
            fig["content"] = item.content
            fig["url"] = item.url
            return Figure.model_validate(fig)
    raise HTTPException(404, "Figure not found")


def get_publication_from_repo(
    project: Project,
    repo: git.Repo,
    path: str,
    ref: str | None = None,
) -> Publication:
    ck_info = get_ck_info_for_ref(project=project, repo=repo, ref=ref)
    publications = ck_info.get("publications", [])
    # Get the figure content (will be base64-encoded)
    for pub in publications:
        if pub.get("path") == path:
            item = get_contents_from_repo(
                project=project,
                repo=repo,
                path=pub["path"],
                ref=ref,
            )
            pub["content"] = item.content
            # Prioritize URL defined in the publication itself
            if "url" not in pub:
                pub["url"] = item.url
            return Publication.model_validate(pub)
    raise HTTPException(404, "Publication not found")


def get_notebook_from_repo(
    project: Project,
    repo: git.Repo,
    path: str,
    ref: str | None = None,
) -> Notebook:
    """Get a notebook from a project's repo, fetching its HTML export if it
    exists.
    """
    ck_info = get_ck_info_for_ref(project=project, repo=repo, ref=ref)
    notebooks = ck_info.get("notebooks", [])
    for notebook in notebooks:
        if notebook.get("path") == path:
            item = get_contents_from_repo(
                project=project,
                repo=repo,
                path=path,
                ref=ref,
            )
            try:
                # If the notebook has HTML output, return that
                html_path = get_executed_notebook_path(
                    notebook_path=path, to="html"
                )
                html_item = get_contents_from_repo(
                    project=project,
                    repo=repo,
                    path=html_path,
                    ref=ref,
                )
                item = html_item
                notebook["output_format"] = "html"
            except HTTPException as e:
                logger.info(
                    f"Notebook HTML does not exist at {html_path}: {e}"
                )
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
            return Notebook.model_validate(notebook)
    raise HTTPException(404, "Notebook not found")
