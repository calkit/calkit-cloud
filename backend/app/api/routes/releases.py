"""Routes for project releases.

Two groups of endpoints live here:

* Project-scoped, authenticated CRUD under
  ``/projects/{owner_name}/{project_name}/releases`` for users with write
  access to manage releases.
* Public, secret-link endpoints under ``/releases/{secret_token}`` that let
  anyone holding the link view the released artifact and (optionally) comment,
  without needing access to the rest of the project.

For this MVP the cloud database is the source of truth for releases; nothing is
written to ``calkit.yaml``. Content for the viewer is fetched at the release's
pinned commit using the release creator's GitHub token, so private repos can be
shared via the secret link without granting repo access.
"""

import logging
import os
import secrets
from datetime import date

from fastapi import APIRouter, HTTPException
from sqlmodel import select

import app.projects
from app import mixpanel, users
from app.api.deps import CurrentUser, CurrentUserOptional, SessionDep
from app.config import settings
from app.core import ryaml
from app.git import get_repo, get_repo_tree_for_ref
from app.models import (
    ContentsItem,
    ExternalReleasePost,
    Message,
    Release,
    ReleaseComment,
    ReleaseCommentPost,
    ReleaseCommentPublic,
    ReleaseListItem,
    ReleasePost,
    ReleasePublic,
    ReleaseView,
)

logger = logging.getLogger("uvicorn")

router = APIRouter()

SECRET_TOKEN_BYTES = 32
# Short cache so the releases page reflects recent calkit.yaml changes.
RELEASES_REPO_TTL = 60


def _abbrev(git_rev: str | None) -> str | None:
    if not git_rev:
        return None
    return git_rev[:7] if len(git_rev) > 7 else git_rev


def _commit_date(repo, rev: str | None) -> str | None:
    """Return the ISO date of a commit or tag, or None if it can't resolve.

    Used to give calkit.yaml releases a date when one isn't declared. ``rev``
    may be a (possibly abbreviated) commit SHA or a tag name. Never raises.
    """
    if not rev:
        return None
    try:
        return repo.commit(rev).committed_datetime.date().isoformat()
    except Exception:
        return None


def _get_release_by_token(session: SessionDep, secret_token: str) -> Release:
    release = session.exec(
        select(Release).where(Release.secret_token == secret_token)
    ).first()
    if release is None:
        raise HTTPException(404, "Release not found")
    return release


def _to_view(release: Release) -> ReleaseView:
    project = release.project
    return ReleaseView(
        name=release.name,
        kind=release.kind,
        path=release.path,
        title=release.title,
        description=release.description,
        git_ref=release.git_ref,
        git_rev_abbrev=release.git_rev_abbrev,
        public=release.public,
        comments_enabled=release.comments_enabled,
        allow_anonymous_comments=release.allow_anonymous_comments,
        comment_count=release.comment_count,
        created=release.created,
        owner_account_name=project.owner_account_name,
        owner_account_display_name=project.owner_account_display_name,
        project_name=project.name,
        project_title=project.title,
    )


@router.post("/projects/{owner_name}/{project_name}/releases")
def post_project_release(
    owner_name: str,
    project_name: str,
    release_in: ReleasePost,
    current_user: CurrentUser,
    session: SessionDep,
) -> ReleasePublic:
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    # Reject duplicate release names within the project upfront for a clear
    # error (the DB also enforces this via a unique constraint).
    existing = session.exec(
        select(Release)
        .where(Release.project_id == project.id)
        .where(Release.name == release_in.name)
    ).first()
    if existing is not None:
        raise HTTPException(
            409, f"A release named '{release_in.name}' already exists"
        )
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    # Resolve the requested ref to a concrete commit. With no ref, pin to the
    # current default-branch HEAD.
    try:
        if release_in.git_ref:
            git_rev = repo.commit(release_in.git_ref).hexsha
        else:
            git_rev = repo.head.commit.hexsha
    except Exception:
        raise HTTPException(
            400, f"Could not resolve Git ref '{release_in.git_ref}'"
        )
    # Only retain a human-readable ref when it names a tag; otherwise the
    # abbreviated commit SHA is the honest provenance label.
    tag_names = {t.name for t in repo.tags}
    git_ref = release_in.git_ref if release_in.git_ref in tag_names else None
    # Verify the released path exists at that commit (skip for whole-project).
    if release_in.path and release_in.path != ".":
        try:
            repo.commit(git_rev).tree / release_in.path
        except Exception:
            raise HTTPException(
                404, f"Path '{release_in.path}' not found at the given ref"
            )
    release = Release(
        project_id=project.id,
        created_by_user_id=current_user.id,
        name=release_in.name,
        kind=release_in.kind,
        path=release_in.path,
        title=release_in.title,
        description=release_in.description,
        git_ref=git_ref,
        git_rev=git_rev,
        public=release_in.public,
        comments_enabled=release_in.comments_enabled,
        allow_anonymous_comments=release_in.allow_anonymous_comments,
        secret_token=secrets.token_urlsafe(SECRET_TOKEN_BYTES),
    )
    session.add(release)
    session.commit()
    session.refresh(release)
    mixpanel.track(
        current_user,
        "Created release",
        {
            "owner_name": owner_name,
            "project_name": project_name,
            "kind": release.kind,
            "public": release.public,
        },
    )
    return release


@router.post("/projects/{owner_name}/{project_name}/releases/external")
def post_external_release(
    owner_name: str,
    project_name: str,
    release_in: ExternalReleasePost,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
    """Declare a release published to an external venue.

    Recorded as an entry in ``calkit.yaml`` (committed and pushed); not hosted
    by Calkit. Loosely coupled -- we only track the metadata.
    """
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
    ck_path = os.path.join(repo.working_dir, "calkit.yaml")
    ck_info = {}
    if os.path.exists(ck_path):
        with open(ck_path) as f:
            ck_info = ryaml.load(f) or {}
    releases = ck_info.get("releases") or {}
    if release_in.name in releases:
        raise HTTPException(
            409,
            f"A release named '{release_in.name}' already exists "
            "in calkit.yaml",
        )
    # Build the entry, omitting empty values to keep calkit.yaml tidy. A
    # missing ``public`` key means public, so only write it when False.
    entry: dict = {
        "kind": release_in.kind,
        "path": release_in.path or ".",
    }
    if release_in.publisher:
        entry["publisher"] = release_in.publisher
    if release_in.url:
        entry["url"] = release_in.url
    if release_in.doi:
        entry["doi"] = release_in.doi
    entry["date"] = release_in.date or date.today().isoformat()
    if release_in.title:
        entry["title"] = release_in.title
    if release_in.description:
        entry["description"] = release_in.description
    if not release_in.public:
        entry["public"] = False
    releases[release_in.name] = entry
    ck_info["releases"] = releases
    with open(ck_path, "w") as f:
        ryaml.dump(ck_info, f)
    repo.git.add("calkit.yaml")
    repo.git.commit(["-m", f"Declare release {release_in.name}"])
    repo.git.push(["origin", repo.active_branch.name])
    mixpanel.track(
        current_user,
        "Declared external release",
        {
            "owner_name": owner_name,
            "project_name": project_name,
            "kind": release_in.kind,
            "publisher": release_in.publisher,
        },
    )
    return Message(message="success")


@router.get("/projects/{owner_name}/{project_name}/releases")
def get_project_releases(
    owner_name: str,
    project_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    ref: str | None = None,
) -> list[ReleaseListItem]:
    """List a project's releases.

    Merges releases declared in ``calkit.yaml`` (public, DOI-bearing) with the
    private secret-link releases stored in this database. The latter are only
    included for users with write access, since they expose a secret token.
    """
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="read",
    )
    has_write = project.current_user_access in ("write", "admin", "owner")
    items: list[ReleaseListItem] = []
    cloud_names: set[str] = set()
    # Cloud (private) releases first -- newest first -- for write users only.
    if has_write:
        cloud = session.exec(
            select(Release)
            .where(Release.project_id == project.id)
            .order_by(Release.created.desc())
        ).all()
        for r in cloud:
            cloud_names.add(r.name)
            items.append(
                ReleaseListItem(
                    source="cloud",
                    name=r.name,
                    kind=r.kind,
                    path=r.path,
                    title=r.title,
                    description=r.description,
                    git_ref=r.git_ref,
                    git_rev=r.git_rev,
                    git_rev_abbrev=r.git_rev_abbrev,
                    public=r.public,
                    url=r.url,
                    doi=r.doi,
                    date=r.created.isoformat(),
                    secret_token=r.secret_token,
                    view_count=r.view_count,
                    comment_count=r.comment_count,
                )
            )
    # Releases declared in calkit.yaml at the requested ref.
    try:
        repo = get_repo(
            project=project,
            user=current_user,
            session=session,
            ttl=RELEASES_REPO_TTL,
            ref=ref,
        )
        ck_info = app.projects.get_ck_info_for_ref(
            project=project, repo=repo, ref=ref
        )
    except Exception as e:
        logger.warning(f"Could not read calkit.yaml releases: {e}")
        ck_info = {}
    ck_releases = ck_info.get("releases", {}) or {}
    for name, rel in ck_releases.items():
        if not isinstance(rel, dict) or name in cloud_names:
            continue
        git_rev = rel.get("git_rev")
        # Prefer the declared date; otherwise fall back to the release's
        # commit date (or its tag's commit), so every release shows a date.
        release_date = str(rel["date"]) if rel.get("date") else None
        if release_date is None:
            release_date = _commit_date(repo, git_rev) or _commit_date(
                repo, name
            )
        items.append(
            ReleaseListItem(
                source="calkit",
                name=name,
                kind=rel.get("kind"),
                path=rel.get("path"),
                title=rel.get("title"),
                description=rel.get("description"),
                git_rev=git_rev,
                git_rev_abbrev=_abbrev(git_rev),
                # A missing ``public`` key means the release is public.
                public=rel.get("public", True),
                url=rel.get("url"),
                doi=rel.get("doi"),
                publisher=rel.get("publisher"),
                date=release_date,
            )
        )
    return items


@router.delete("/projects/{owner_name}/{project_name}/releases/{release_name}")
def delete_project_release(
    owner_name: str,
    project_name: str,
    release_name: str,
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
    release = session.exec(
        select(Release)
        .where(Release.project_id == project.id)
        .where(Release.name == release_name)
    ).first()
    if release is None:
        raise HTTPException(404, "Release not found")
    session.delete(release)
    session.commit()
    return Message(message="success")


@router.get("/releases/{secret_token}")
def get_release(secret_token: str, session: SessionDep) -> ReleaseView:
    release = _get_release_by_token(session, secret_token)
    # Count the visit. Kept simple (every GET counts); good enough for an
    # at-a-glance signal.
    release.view_count += 1
    session.add(release)
    session.commit()
    session.refresh(release)
    return _to_view(release)


@router.get("/releases/{secret_token}/content")
def get_release_content(
    secret_token: str, session: SessionDep
) -> ContentsItem:
    release = _get_release_by_token(session, secret_token)
    if not release.path or release.path == ".":
        raise HTTPException(
            400, "This release does not point at a single file"
        )
    project = release.project
    # Fetch using the release creator's token so private repos are readable.
    repo = get_repo(
        project=project,
        user=release.created_by,
        session=session,
        ttl=None,
        ref=release.git_rev,
    )
    tree = get_repo_tree_for_ref(repo, release.git_rev)
    ck_info, dvc_lock_outs, zip_path_map = (
        app.projects.get_ck_info_and_dvc_outs_from_tree(project, tree)
    )
    item = app.projects.get_contents_from_tree(
        project=project,
        tree=tree,
        path=release.path,
        ck_info=ck_info,
        dvc_lock_outs=dvc_lock_outs,
        zip_path_map=zip_path_map,
    )
    return item


@router.get("/releases/{secret_token}/comments")
def get_release_comments(
    secret_token: str, session: SessionDep
) -> list[ReleaseCommentPublic]:
    release = _get_release_by_token(session, secret_token)
    comments = session.exec(
        select(ReleaseComment)
        .where(ReleaseComment.release_id == release.id)
        .order_by(ReleaseComment.created.asc())
    ).all()
    return [
        ReleaseCommentPublic(
            id=c.id,
            author_name=c.author_name,
            comment=c.comment,
            external_url=c.external_url,
            created=c.created,
        )
        for c in comments
    ]


@router.post("/releases/{secret_token}/comments")
def post_release_comment(
    secret_token: str,
    comment_in: ReleaseCommentPost,
    current_user: CurrentUserOptional,
    session: SessionDep,
) -> ReleaseCommentPublic:
    release = _get_release_by_token(session, secret_token)
    if not release.comments_enabled:
        raise HTTPException(403, "Comments are disabled for this release")
    if current_user is None and not release.allow_anonymous_comments:
        raise HTTPException(401, "You must be logged in to comment")
    # Prefer the logged-in user's name; fall back to the supplied display name.
    if current_user is not None:
        author_name = (
            current_user.full_name or current_user.account.github_name
        )
    else:
        author_name = (comment_in.author_name or "").strip() or None
    comment = ReleaseComment(
        release_id=release.id,
        user_id=current_user.id if current_user is not None else None,
        author_name=author_name,
        comment=comment_in.comment,
    )
    session.add(comment)
    session.flush()
    # Mirror the comment to a GitHub issue using the release creator's token,
    # since anonymous commenters have none. Failures never block the comment.
    external_url = _try_create_release_github_issue(
        session=session, release=release, comment=comment
    )
    if external_url:
        comment.external_url = external_url
    session.commit()
    session.refresh(comment)
    return ReleaseCommentPublic(
        id=comment.id,
        author_name=comment.author_name,
        comment=comment.comment,
        external_url=comment.external_url,
        created=comment.created,
    )


def _try_create_release_github_issue(
    session: SessionDep, release: Release, comment: ReleaseComment
) -> str | None:
    """Open a GitHub issue for a release comment, using the creator's token.

    Returns None (and never raises) if there's no GitHub repo or token.
    """
    project = release.project
    github_repo = project.github_repo
    if not github_repo:
        return None
    try:
        token = users.get_github_token(session, release.created_by)
    except Exception:
        logger.info("Skipping release issue creation: no GitHub token")
        return None
    import requests

    app_base = settings.frontend_host.rstrip("/")
    link = f"{app_base}/releases/{release.secret_token}"
    author = comment.author_name or "Anonymous"
    title = f"Feedback on release {release.name}"
    if release.path:
        title += f" ({release.path})"
    body = "\n".join(
        [
            f"Comment from **{author}** on [release {release.name}]({link}):",
            "",
            comment.comment,
        ]
    )
    try:
        resp = requests.post(
            f"https://api.github.com/repos/{github_repo}/issues",
            json={"title": title, "body": body},
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )
    except Exception as exc:
        logger.warning(f"Release issue creation failed: {exc}")
        return None
    if not resp.ok:
        logger.warning(
            f"Release issue creation failed for {github_repo}: "
            f"{resp.status_code} {resp.text}"
        )
        return None
    return resp.json().get("html_url")
