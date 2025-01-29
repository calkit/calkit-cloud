"""Functionality for working with projects"""

import base64
import logging
import os
from typing import Literal

import git
import yaml
from fastapi import HTTPException
from sqlmodel import Session, select

from app.core import CATEGORIES_PLURAL_TO_SINGULAR
from app.dvc import output_from_pipeline
from app.git import get_ck_info_from_repo
from app.models import (
    ContentsItem,
    Figure,
    ItemLock,
    Org,
    Project,
    Publication,
    User,
)
from app.storage import (
    get_object_fs,
    get_object_url,
    make_data_fpath,
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
    query = (
        select(Project)
        .where(Project.owner_account.has(name=owner_name))
        .where(Project.name == project_name)
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
        elif project.is_public and project.current_user_access is None:
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
) -> ContentsItem:
    owner_name = project.owner_account_name
    project_name = project.name
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
    # Check if it exists in the repo
    if os.path.isfile(os.path.join(repo_dir, path)):
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
            fs = get_object_fs()
            fp = make_data_fpath(
                owner_name=owner_name,
                project_name=project_name,
                idx=md5[:2],
                md5=md5[2:],
            )
            url = get_object_url(fp, fname=os.path.basename(dvc_fpath), fs=fs)
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
            fs = get_object_fs()
            fp = make_data_fpath(
                owner_name=owner_name,
                project_name=project_name,
                idx=md5[:2],
                md5=md5[2:],
            )
            url = get_object_url(fp, fname=os.path.basename(path), fs=fs)
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


def get_figure_from_repo(
    project: Project,
    repo: git.Repo,
    path: str,
) -> Figure:
    ck_info = get_ck_info_from_repo(repo)
    figures = ck_info.get("figures", [])
    # Get the figure content (will be base64-encoded)
    for fig in figures:
        if fig.get("path") == path:
            item = get_contents_from_repo(
                project=project,
                repo=repo,
                path=fig["path"],
            )
            fig["content"] = item.content
            fig["url"] = item.url
            return Figure.model_validate(fig)
    raise HTTPException(404, "Figure not found")


def get_publication_from_repo(
    project: Project, repo: git.Repo, path: str
) -> Publication:
    ck_info = get_ck_info_from_repo(repo)
    publications = ck_info.get("publications", [])
    # Get the figure content (will be base64-encoded)
    for pub in publications:
        if pub.get("path") == path:
            item = get_contents_from_repo(
                project=project,
                repo=repo,
                path=pub["path"],
            )
            pub["content"] = item.content
            # Prioritize URL defined in the publication itself
            if "url" not in pub:
                pub["url"] = item.url
            return Publication.model_validate(pub)
    raise HTTPException(404, "Publication not found")
