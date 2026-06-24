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

import hashlib
import logging
import os
import re
import secrets
import xml.etree.ElementTree as ET
from datetime import date

import requests
import sqlalchemy
from calkit.models import Release as CkRelease
from fastapi import APIRouter, HTTPException
from git.exc import GitCommandError
from sqlmodel import select

import app.projects
from app import messaging, mixpanel, users
from app.api.deps import CurrentUser, CurrentUserOptional, SessionDep
from app.config import settings
from app.core import ryaml, utcnow
from app.git import get_repo, get_repo_tree_for_ref
from app.models import (
    ContentsItem,
    ExternalReleasePost,
    Message,
    Project,
    Release,
    ReleaseComment,
    ReleaseCommentPost,
    ReleaseCommentPublic,
    ReleaseListItem,
    ReleasePost,
    ReleasePublic,
    ReleaseShareToken,
    ReleaseShareTokenCreated,
    ReleaseShareTokenPost,
    ReleaseShareTokenPublic,
    ReleaseStaleness,
    ReleaseUrlImport,
    ReleaseUrlMetadata,
    ReleaseView,
    User,
)
from app.pipeline import compute_stage_statuses, find_stage_for_path
from app.storage import get_object_fs

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


def _resolve_rev(repo, rev: str | None) -> str | None:
    """Resolve a ref (tag, branch, or SHA) to a full commit SHA, or None.

    Lets a release keyed only by its tag (e.g. an imported GitHub release)
    expose the exact commit it points at, so it can be browsed at that version.
    Never raises.
    """
    if not rev:
        return None
    try:
        return repo.commit(rev).hexsha
    except Exception:
        return None


def _path_staleness(
    repo,
    git_rev: str | None,
    path: str | None,
    owner_name: str,
    project_name: str,
) -> ReleaseStaleness:
    """Report whether the pipeline stage that produces *path* is up-to-date.

    Returns an ``up_to_date=True`` result (staleness not applicable) when the
    path is the whole project, isn't produced by any stage, or status can't be
    determined. Never raises.
    """
    result = ReleaseStaleness(path=path)
    if not path or path == ".":
        return result
    try:
        tree = get_repo_tree_for_ref(repo, git_rev)
        dvc_lock: dict = {}
        if tree.is_file("dvc.lock"):
            dvc_lock = ryaml.load(tree.read_bytes("dvc.lock").decode()) or {}
        stage = find_stage_for_path(path, dvc_lock)
        if stage is None:
            return result
        dvc_yaml: dict = {}
        if tree.is_file("dvc.yaml"):
            dvc_yaml = ryaml.load(tree.read_bytes("dvc.yaml").decode()) or {}
        statuses = compute_stage_statuses(
            dvc_yaml=dvc_yaml,
            dvc_lock=dvc_lock,
            tree=tree,
            owner_name=owner_name,
            project_name=project_name,
            fs=get_object_fs(),
            cache_token=git_rev,
        )
        ss = statuses.get(stage)
        if ss is None:
            return result
        result.stage = stage
        result.status = ss.status
        result.up_to_date = ss.status not in ("stale", "not-run")
        result.modified_inputs = ss.modified_inputs
        result.modified_outputs = ss.modified_outputs
        result.missing_outputs = ss.missing_outputs
    except Exception as e:
        logger.warning(f"Failed to compute release staleness for {path}: {e}")
    return result


def _get_project_unchecked(
    session: SessionDep, owner_name: str, project_name: str
) -> Project:
    """Look up a project without enforcing the caller's access level.

    Used on the share-link paths, where authorization comes from a valid share
    token rather than project membership, so we can't go through
    ``get_project`` (which 403s a logged-in non-member of a private project).
    """
    project = session.exec(
        select(Project)
        .where(Project.owner_account.has(name=owner_name.lower()))
        .where(sqlalchemy.func.lower(Project.name) == project_name.lower())
    ).first()
    if project is None:
        raise HTTPException(404, "Project not found")
    return project


def _member_access(
    session: SessionDep, project: Project, current_user: User | None
) -> str | None:
    """The caller's project access level, or None if they aren't a member.

    Never raises -- a logged-in user with no access to a private project comes
    back as None (or ``read`` for a public project) so the share-token path can
    still authorize them.
    """
    if current_user is None:
        return "read" if project.is_public else None
    try:
        p = app.projects.get_project(
            session=session,
            owner_name=project.owner_account_name,
            project_name=project.name,
            current_user=current_user,
            min_access_level=None,
        )
        return p.current_user_access
    except HTTPException:
        return "read" if project.is_public else None


def _hash_share_token(token: str) -> str:
    """SHA-256 of a raw share token; only the hash is ever stored."""
    return hashlib.sha256(token.encode()).hexdigest()


def _send_share_email(
    project: Project,
    release: Release,
    token: ReleaseShareToken,
    raw_token: str,
    inviter_user: User,
) -> bool:
    """Best-effort send of a share invite; returns whether it went out.

    A no-op (returning False) when there's no recipient or email isn't
    configured, so creating a share never fails just because SMTP is unset --
    the caller still shows the copyable link.
    """
    if not token.email or not settings.emails_enabled:
        return False
    app_base = settings.frontend_host.rstrip("/")
    link = (
        f"{app_base}/{project.owner_account_name}/{project.name}"
        f"/releases/{release.name}?token={raw_token}"
    )
    inviter = inviter_user.full_name or inviter_user.email
    email_data = messaging.generate_release_share_email(
        email_to=token.email,
        project_name=project.name,
        release_name=release.name,
        link=link,
        inviter=inviter,
        permission=token.permission,
        note=token.note,
    )
    try:
        messaging.send_email(
            email_to=token.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
        return True
    except Exception:
        logger.exception("Failed to send release share email")
        return False


def _valid_share_token(
    session: SessionDep, release: Release, token: str | None
) -> ReleaseShareToken | None:
    """Return the live (non-revoked, non-expired) share token for a release."""
    if not token:
        return None
    st = session.exec(
        select(ReleaseShareToken)
        .where(ReleaseShareToken.release_id == release.id)
        .where(ReleaseShareToken.token_hash == _hash_share_token(token))
    ).first()
    if st is None or st.revoked:
        return None
    if st.expires_at is not None and st.expires_at < utcnow():
        return None
    return st


def _authorize_release(
    session: SessionDep,
    owner_name: str,
    project_name: str,
    release_name: str,
    token: str | None,
    current_user: User | None,
) -> tuple[Release, str, ReleaseShareToken | None]:
    """Resolve a release and the caller's effective permission.

    Permission is ``manage`` for a project member with write access, otherwise
    ``comment``/``view`` from a valid share token, otherwise ``view`` for a
    project member with read access. Raises 404 if the release doesn't exist
    and 403 when the caller has neither membership nor a valid token.
    """
    project = _get_project_unchecked(session, owner_name, project_name)
    release = session.exec(
        select(Release)
        .where(Release.project_id == project.id)
        .where(Release.name == release_name)
    ).first()
    if release is None:
        raise HTTPException(404, "Release not found")
    access = _member_access(session, project, current_user)
    if access in ("write", "admin", "owner"):
        return release, "manage", None
    st = _valid_share_token(session, release, token)
    if st is not None:
        permission = st.permission if st.permission == "comment" else "view"
        return release, permission, st
    if access == "read":
        return release, "view", None
    raise HTTPException(403, "A valid share link is required to view this")


def _to_view(
    release: Release,
    permission: str,
    share_token: ReleaseShareToken | None,
) -> ReleaseView:
    project = release.project
    return ReleaseView(
        name=release.name,
        kind=release.kind,
        path=release.path,
        description=release.description,
        git_ref=release.git_ref,
        git_rev_abbrev=release.git_rev_abbrev,
        public=release.public,
        comments_enabled=release.comments_enabled,
        comment_count=release.comment_count,
        created=release.created,
        owner_account_name=project.owner_account_name,
        owner_account_display_name=project.owner_account_display_name,
        project_name=project.name,
        project_title=project.title,
        permission=permission,
        viewer_email=share_token.email if share_token is not None else None,
    )


def _record_internal_release_in_calkit_yaml(
    repo, release_in: ReleasePost, git_rev: str
) -> None:
    """Write an ``internal: true`` entry to ``calkit.yaml`` and push it.

    Mirrors the cloud release into the project's portable source of truth so it
    shows up wherever ``calkit.yaml`` is read. The cloud database keeps the
    review-only data (share tokens, comments, view counts). On a push failure
    the working clone is reset so the next request starts clean.
    """
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
    # An internal release is pinned to a commit and hosted for review rather
    # than published, so it carries no publisher or DOI. Serialize through
    # calkit's Release model so the entry always matches the canonical schema.
    entry = CkRelease(
        kind=release_in.kind,
        path=release_in.path or ".",
        internal=True,
        git_rev=git_rev,
        date=date.today().isoformat(),
        description=release_in.description or None,
    ).model_dump(exclude_none=True, exclude_defaults=True)
    releases[release_in.name] = entry
    ck_info["releases"] = releases
    with open(ck_path, "w") as f:
        ryaml.dump(ck_info, f)
    try:
        repo.git.add("calkit.yaml")
        repo.git.commit(["-m", f"Add internal release {release_in.name}"])
        repo.git.push(["origin", repo.active_branch.name])
    except GitCommandError as e:
        repo.git.reset(["--hard", "origin/" + repo.active_branch.name])
        logger.warning(f"Failed to push internal release to calkit.yaml: {e}")
        raise HTTPException(
            502,
            "Couldn't record the release in calkit.yaml. Check that you have "
            "push access to the repository.",
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
    # Accept files tracked in git OR produced/tracked via DVC (e.g. a built
    # paper PDF that the pipeline writes but isn't committed to git), matching
    # how the release content is later served.
    if release_in.path and release_in.path != ".":
        try:
            repo.commit(git_rev).tree / release_in.path
        except Exception:
            try:
                tree = get_repo_tree_for_ref(repo, git_rev)
                (
                    ck_info,
                    dvc_lock_outs,
                    zip_path_map,
                ) = app.projects.get_ck_info_and_dvc_outs_from_tree(
                    project, tree
                )
                app.projects.get_contents_from_tree(
                    project=project,
                    tree=tree,
                    path=release_in.path,
                    ck_info=ck_info,
                    dvc_lock_outs=dvc_lock_outs,
                    zip_path_map=zip_path_map,
                )
            except Exception:
                raise HTTPException(
                    404,
                    f"Path '{release_in.path}' not found at the given ref",
                )
    # Don't re-release the same artifact at the same commit. Every release
    # (cloud, CLI, or external) is recorded in calkit.yaml, so it's the single
    # place to check; a release at a newer commit is fine (it's a new version).
    new_path = release_in.path or "."
    ck_path = os.path.join(repo.working_dir, "calkit.yaml")
    if os.path.exists(ck_path):
        with open(ck_path) as f:
            existing_ck = ryaml.load(f) or {}
        for rname, rel in (existing_ck.get("releases") or {}).items():
            if not isinstance(rel, dict):
                continue
            rrev = rel.get("git_rev")
            if (
                rrev
                and git_rev.startswith(str(rrev))
                and (rel.get("path") or ".") == new_path
            ):
                where = "the project" if new_path == "." else f"'{new_path}'"
                raise HTTPException(
                    409,
                    f"{where} at this commit is already released as "
                    f"'{rname}'.",
                )
    # Block releasing a possibly non-reproducible artifact unless the user has
    # acknowledged it. Staleness is checked against the pinned commit.
    if not release_in.acknowledge_non_reproducible:
        staleness = _path_staleness(
            repo,
            git_rev,
            release_in.path,
            project.owner_account_name,
            project.name,
        )
        if not staleness.up_to_date:
            raise HTTPException(
                409,
                "The pipeline stage that produces this path is not up to date, "
                "so the artifact may not be reproducible. Re-run the pipeline, "
                "or acknowledge to release it anyway.",
            )
    release = Release(
        project_id=project.id,
        created_by_user_id=current_user.id,
        name=release_in.name,
        kind=release_in.kind,
        path=release_in.path,
        description=release_in.description,
        git_ref=git_ref,
        git_rev=git_rev,
        public=release_in.public,
        comments_enabled=release_in.comments_enabled,
    )
    session.add(release)
    session.flush()
    # Persist the release to calkit.yaml as an internal release so it's part of
    # the project's portable source of truth; roll back the DB row if the push
    # fails so the two stores stay consistent.
    try:
        _record_internal_release_in_calkit_yaml(repo, release_in, git_rev)
    except Exception:
        session.rollback()
        raise
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
    # Serialize through calkit's Release model so the entry matches the
    # canonical schema; exclude_none/defaults keeps calkit.yaml tidy.
    entry = CkRelease(
        kind=release_in.kind,
        path=release_in.path or ".",
        publisher=release_in.publisher or None,
        url=release_in.url or None,
        doi=release_in.doi or None,
        date=release_in.date or date.today().isoformat(),
        description=release_in.description or None,
    ).model_dump(exclude_none=True, exclude_defaults=True)
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


# External lookups time out rather than hang the request on a slow venue.
URL_LOOKUP_TIMEOUT = 10
DOI_RE = re.compile(r"10\.\d{4,9}/[^\s\"'<>]+", re.IGNORECASE)
ARXIV_ID_RE = re.compile(
    r"(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?/\d{7})", re.IGNORECASE
)
# CSL-JSON resource types mapped to calkit release kinds.
CSL_KIND_MAP = {
    "dataset": "dataset",
    "article-journal": "publication",
    "article": "publication",
    "posted-content": "publication",
    "paper-conference": "publication",
    "report": "publication",
    "software": "publication",
}


def _arxiv_id_from_url(url: str) -> str | None:
    lower = url.lower()
    if "arxiv.org" not in lower and "arxiv:" not in lower:
        return None
    m = ARXIV_ID_RE.search(url)
    return m.group(1) if m else None


def _doi_from_url(url: str) -> str | None:
    m = DOI_RE.search(url)
    if m:
        # Trim trailing punctuation that often rides along in a pasted URL.
        return m.group(0).rstrip(".,);]\"'")
    # A Zenodo record page URL has no DOI in it, but the DOI is derivable from
    # the numeric record id.
    zm = re.search(r"zenodo\.org/records?/(\d+)", url, re.IGNORECASE)
    if zm:
        return f"10.5281/zenodo.{zm.group(1)}"
    return None


def _fetch_arxiv(arxiv_id: str) -> ReleaseUrlMetadata | None:
    # Strip the version for the query but keep it in the canonical abs URL.
    base_id = re.sub(r"v\d+$", "", arxiv_id)
    resp = requests.get(
        "http://export.arxiv.org/api/query",
        params={"id_list": base_id},
        timeout=URL_LOOKUP_TIMEOUT,
    )
    if resp.status_code >= 400:
        return None
    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError:
        return None
    ns = {
        "a": "http://www.w3.org/2005/Atom",
        "arxiv": "http://arxiv.org/schemas/atom",
    }
    entry = root.find("a:entry", ns)
    if entry is None:
        return None
    # An unknown id still returns an <entry>, but with an error id and no title.
    id_el = entry.find("a:id", ns)
    if id_el is not None and "api/errors" in (id_el.text or ""):
        return None
    title_el = entry.find("a:title", ns)
    title = (title_el.text or "").strip() if title_el is not None else None
    if not title:
        return None
    published_el = entry.find("a:published", ns)
    date_str = (
        published_el.text[:10]
        if published_el is not None and published_el.text
        else None
    )
    summary_el = entry.find("a:summary", ns)
    description = (
        " ".join((summary_el.text or "").split())
        if summary_el is not None
        else None
    )
    # Prefer a journal DOI the authors registered (arxiv:doi); otherwise fall
    # back to the DOI arXiv mints for every paper (10.48550/arXiv.<id>).
    doi_el = entry.find("arxiv:doi", ns)
    doi = (
        (doi_el.text or "").strip()
        if doi_el is not None and doi_el.text
        else f"10.48550/arXiv.{base_id}"
    )
    return ReleaseUrlMetadata(
        publisher="arxiv",
        title=title,
        doi=doi,
        url=f"https://arxiv.org/abs/{arxiv_id}",
        date=date_str,
        description=description or None,
        kind="publication",
    )


def _fetch_doi(doi: str) -> ReleaseUrlMetadata | None:
    resp = requests.get(
        f"https://doi.org/{doi}",
        headers={"Accept": "application/vnd.citationstyles.csl+json"},
        timeout=URL_LOOKUP_TIMEOUT,
    )
    if resp.status_code >= 400:
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    title = data.get("title")
    if isinstance(title, list):
        title = title[0] if title else None
    # issued.date-parts looks like [[YYYY, MM, DD]] (month/day optional).
    date_str = None
    issued = data.get("issued")
    parts = issued.get("date-parts") if isinstance(issued, dict) else None
    if isinstance(parts, list) and parts and isinstance(parts[0], list):
        date_str = "-".join(
            f"{int(x):02d}" if i else str(int(x))
            for i, x in enumerate(parts[0])
        )
    description = data.get("abstract")
    return ReleaseUrlMetadata(
        publisher=data.get("publisher") or None,
        title=title.strip() if isinstance(title, str) else None,
        doi=data.get("DOI") or doi,
        url=data.get("URL") or f"https://doi.org/{doi}",
        date=date_str,
        description=(
            description.strip() if isinstance(description, str) else None
        ),
        kind=CSL_KIND_MAP.get(str(data.get("type") or ""), "publication"),
    )


def _parse_release_url(url: str) -> ReleaseUrlMetadata | None:
    """Recognize a release URL/DOI and fetch its metadata, or None.

    arXiv is checked before DOI because arXiv DOIs (``10.48550/arXiv.*``) would
    otherwise resolve to a less useful generic record.
    """
    url = url.strip()
    arxiv_id = _arxiv_id_from_url(url)
    if arxiv_id:
        return _fetch_arxiv(arxiv_id)
    doi = _doi_from_url(url)
    if doi:
        return _fetch_doi(doi)
    return None


@router.post("/projects/{owner_name}/{project_name}/releases/parse-url")
def parse_release_url(
    owner_name: str,
    project_name: str,
    req: ReleaseUrlImport,
    current_user: CurrentUser,
    session: SessionDep,
) -> ReleaseUrlMetadata:
    """Look up an already-published release from a URL or DOI.

    Recognizes DOIs (resolved via doi.org content negotiation, which covers
    Zenodo, CaltechDATA, journals, and more) and arXiv links/IDs, fetching
    metadata to pre-fill the declare-external form. Fails if we can't recognize
    or fetch the URL -- the user can still declare the release manually.
    """
    app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    try:
        meta = _parse_release_url(req.url)
    except Exception:
        # A lookup should never 500 -- a flaky venue or an unexpected response
        # shape just means we couldn't resolve it.
        logger.warning(
            "Failed to parse release URL %r", req.url, exc_info=True
        )
        meta = None
    if meta is None:
        raise HTTPException(
            422,
            "Couldn't recognize or fetch metadata from that URL. Supported: "
            "DOIs (Zenodo, journals, …) and arXiv links.",
        )
    mixpanel.track(
        current_user,
        "Parsed release URL",
        {
            "owner_name": owner_name,
            "project_name": project_name,
            "publisher": meta.publisher,
        },
    )
    return meta


@router.post("/projects/{owner_name}/{project_name}/releases/import-github")
def import_github_releases(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> Message:
    """Import GitHub releases not yet recorded in ``calkit.yaml``.

    A one-way import: ``calkit.yaml`` is the portable source of truth for
    project releases, so this pulls any GitHub releases that aren't already
    declared there (keyed by tag name) and records them with a link back to the
    GitHub release. Existing entries are left untouched. Commits and pushes once
    if anything changed.
    """
    project = app.projects.get_project(
        session=session,
        owner_name=owner_name,
        project_name=project_name,
        current_user=current_user,
        min_access_level="write",
    )
    token = users.get_github_token(session=session, user=current_user)
    gh_url = f"https://api.github.com/repos/{project.github_repo}/releases"
    resp = requests.get(gh_url, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code >= 400:
        raise HTTPException(400, "Failed to fetch GitHub releases")
    gh_releases = resp.json()
    if not isinstance(gh_releases, list):
        raise HTTPException(502, "Unexpected response from GitHub")
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    ck_path = os.path.join(repo.working_dir, "calkit.yaml")
    ck_info = {}
    if os.path.exists(ck_path):
        with open(ck_path) as f:
            ck_info = ryaml.load(f) or {}
    releases = ck_info.get("releases") or {}
    imported: list[str] = []
    for gh in gh_releases:
        tag = gh.get("tag_name")
        if not tag or tag in releases:
            continue
        published = gh.get("published_at") or gh.get("created_at")
        entry = CkRelease(
            kind="project",
            path=".",
            publisher="github",
            url=gh.get("html_url"),
            date=published[:10] if published else None,
            description=gh.get("body") or None,
        ).model_dump(exclude_none=True, exclude_defaults=True)
        releases[tag] = entry
        imported.append(tag)
    if not imported:
        return Message(message="No new GitHub releases to import")
    ck_info["releases"] = releases
    with open(ck_path, "w") as f:
        ryaml.dump(ck_info, f)
    try:
        repo.git.add("calkit.yaml")
        repo.git.commit(
            ["-m", f"Import {len(imported)} release(s) from GitHub"]
        )
        repo.git.push(["origin", repo.active_branch.name])
    except GitCommandError as e:
        # Leave the cached clone clean for the next request and surface a
        # meaningful error instead of an opaque 500 (e.g. the user has Calkit
        # write access but not GitHub push access to the repo).
        repo.git.reset(["--hard", "origin/" + repo.active_branch.name])
        logger.warning(f"Failed to commit/push imported releases: {e}")
        raise HTTPException(
            502,
            "Imported the releases, but couldn't push to GitHub. Check that "
            "you have push access to the repository.",
        )
    mixpanel.track(
        current_user,
        "Imported GitHub releases",
        {
            "owner_name": owner_name,
            "project_name": project_name,
            "count": len(imported),
        },
    )
    return Message(message=f"Imported {len(imported)} release(s) from GitHub")


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
    hosted review releases stored in this database. The latter are only
    included for users with write access, since they carry share-link counts.
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
            active_shares = sum(1 for t in r.share_tokens if not t.revoked)
            items.append(
                ReleaseListItem(
                    source="cloud",
                    name=r.name,
                    kind=r.kind,
                    path=r.path,
                    description=r.description,
                    git_ref=r.git_ref,
                    git_rev=r.git_rev,
                    git_rev_abbrev=r.git_rev_abbrev,
                    public=r.public,
                    url=r.url,
                    doi=r.doi,
                    date=r.created.isoformat(),
                    internal=True,
                    view_count=r.view_count,
                    comment_count=r.comment_count,
                    share_count=active_shares,
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
        git_ref = rel.get("git_ref")
        # Releases declared in calkit.yaml (e.g. imported from GitHub) are keyed
        # by their tag but often don't record a commit. Resolve the tag (the
        # release name) to its commit so the release can be browsed at its exact
        # version, and surface the tag as the human-readable ref.
        if not git_rev:
            resolved = _resolve_rev(repo, name)
            if resolved:
                git_rev = resolved
                git_ref = git_ref or name
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
                description=rel.get("description"),
                git_ref=git_ref,
                git_rev=git_rev,
                git_rev_abbrev=_abbrev(git_rev),
                # A missing ``public`` key means public. Visibility is separate
                # from where it was released (internal vs an external venue).
                public=rel.get("public", True),
                url=rel.get("url"),
                doi=rel.get("doi"),
                publisher=rel.get("publisher"),
                date=release_date,
                internal=bool(rel.get("internal", False)),
            )
        )
    return items


@router.get("/projects/{owner_name}/{project_name}/releases/staleness")
def get_release_staleness(
    owner_name: str,
    project_name: str,
    current_user: CurrentUser,
    session: SessionDep,
    path: str | None = None,
    git_ref: str | None = None,
) -> ReleaseStaleness:
    """Report whether the artifact at *path* is up-to-date with its pipeline
    stage, so the New Release form can warn before releasing something that may
    not be reproducible.
    """
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
        ttl=RELEASES_REPO_TTL,
    )
    try:
        if git_ref:
            git_rev = repo.commit(git_ref).hexsha
        else:
            git_rev = repo.head.commit.hexsha
    except Exception:
        raise HTTPException(400, f"Could not resolve Git ref '{git_ref}'")
    return _path_staleness(
        repo, git_rev, path, project.owner_account_name, project.name
    )


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
    # Keep calkit.yaml in sync: drop the matching internal release entry (and
    # push) before deleting the DB row, so it doesn't reappear as a calkit.yaml
    # release. Only entries we own (internal) are touched.
    repo = get_repo(
        project=project, user=current_user, session=session, ttl=None
    )
    ck_path = os.path.join(repo.working_dir, "calkit.yaml")
    ck_info = {}
    if os.path.exists(ck_path):
        with open(ck_path) as f:
            ck_info = ryaml.load(f) or {}
    releases = ck_info.get("releases") or {}
    entry = releases.get(release_name)
    if isinstance(entry, dict) and entry.get("internal"):
        del releases[release_name]
        ck_info["releases"] = releases
        with open(ck_path, "w") as f:
            ryaml.dump(ck_info, f)
        try:
            repo.git.add("calkit.yaml")
            repo.git.commit(["-m", f"Remove internal release {release_name}"])
            repo.git.push(["origin", repo.active_branch.name])
        except GitCommandError as e:
            repo.git.reset(["--hard", "origin/" + repo.active_branch.name])
            logger.warning(f"Failed to push release removal: {e}")
            raise HTTPException(
                502,
                "Couldn't remove the release from calkit.yaml. Check that you "
                "have push access to the repository.",
            )
    session.delete(release)
    session.commit()
    return Message(message="success")


# --- Share token management (project members with write access) -------------


@router.post(
    "/projects/{owner_name}/{project_name}/releases/{release_name}/shares"
)
def create_release_share(
    owner_name: str,
    project_name: str,
    release_name: str,
    share_in: ReleaseShareTokenPost,
    current_user: CurrentUser,
    session: SessionDep,
) -> ReleaseShareTokenCreated:
    """Mint a share link for a release, optionally scoped to an email.

    The raw token is returned only here, once -- afterwards only its hash is
    stored, so it can't be recovered from the manage list.
    """
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
    if share_in.permission not in ("view", "comment"):
        raise HTTPException(400, "Permission must be 'view' or 'comment'")
    raw_token = secrets.token_urlsafe(SECRET_TOKEN_BYTES)
    token = ReleaseShareToken(
        release_id=release.id,
        created_by_user_id=current_user.id,
        token_hash=_hash_share_token(raw_token),
        email=(share_in.email or "").strip() or None,
        permission=share_in.permission,
        note=(share_in.note or "").strip() or None,
        expires_at=share_in.expires_at,
    )
    session.add(token)
    session.commit()
    session.refresh(token)
    email_sent = _send_share_email(
        project, release, token, raw_token, current_user
    )
    return ReleaseShareTokenCreated(
        id=token.id,
        token=raw_token,
        email=token.email,
        permission=token.permission,
        note=token.note,
        expires_at=token.expires_at,
        revoked=token.revoked,
        view_count=token.view_count,
        created=token.created,
        email_sent=email_sent,
    )


@router.get(
    "/projects/{owner_name}/{project_name}/releases/{release_name}/shares"
)
def list_release_shares(
    owner_name: str,
    project_name: str,
    release_name: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[ReleaseShareTokenPublic]:
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
    tokens = session.exec(
        select(ReleaseShareToken)
        .where(ReleaseShareToken.release_id == release.id)
        .order_by(ReleaseShareToken.created.desc())
    ).all()
    return list(tokens)


@router.delete(
    "/projects/{owner_name}/{project_name}/releases/{release_name}"
    "/shares/{token_id}"
)
def delete_release_share(
    owner_name: str,
    project_name: str,
    release_name: str,
    token_id: str,
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
    token = session.exec(
        select(ReleaseShareToken)
        .where(ReleaseShareToken.id == token_id)
        .where(ReleaseShareToken.release_id == release.id)
    ).first()
    if token is None:
        raise HTTPException(404, "Share link not found")
    session.delete(token)
    session.commit()
    return Message(message="success")


# --- Release viewing (project members or share-token holders) ---------------


@router.get(
    "/projects/{owner_name}/{project_name}/releases/{release_name}/view"
)
def get_release_view(
    owner_name: str,
    project_name: str,
    release_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    token: str | None = None,
) -> ReleaseView:
    """The release page payload, for a member or a share-token holder."""
    release, permission, share_token = _authorize_release(
        session, owner_name, project_name, release_name, token, current_user
    )
    # Count the visit. Kept simple (every GET counts); a good enough signal.
    release.view_count += 1
    session.add(release)
    if share_token is not None:
        share_token.view_count += 1
        session.add(share_token)
    session.commit()
    session.refresh(release)
    return _to_view(release, permission, share_token)


@router.get(
    "/projects/{owner_name}/{project_name}/releases/{release_name}/content"
)
def get_release_content(
    owner_name: str,
    project_name: str,
    release_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    token: str | None = None,
) -> ContentsItem:
    release, _permission, _share = _authorize_release(
        session, owner_name, project_name, release_name, token, current_user
    )
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
    (
        ck_info,
        dvc_lock_outs,
        zip_path_map,
    ) = app.projects.get_ck_info_and_dvc_outs_from_tree(project, tree)
    item = app.projects.get_contents_from_tree(
        project=project,
        tree=tree,
        path=release.path,
        ck_info=ck_info,
        dvc_lock_outs=dvc_lock_outs,
        zip_path_map=zip_path_map,
    )
    return item


@router.get(
    "/projects/{owner_name}/{project_name}/releases/{release_name}/contents"
)
def get_release_contents(
    owner_name: str,
    project_name: str,
    release_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    path: str | None = None,
    token: str | None = None,
) -> ContentsItem:
    """Browse the project's files at the release's ref.

    Read-only and pinned to the release's commit -- fetched with the creator's
    GitHub token so private repos can be browsed without granting repo access.
    Restricted to whole-project releases; single-artifact releases must not
    expose the rest of the repo, so they 403 here (use ``/content`` instead).
    """
    release, _permission, _share = _authorize_release(
        session, owner_name, project_name, release_name, token, current_user
    )
    if release.path and release.path != ".":
        raise HTTPException(
            403, "This release shares a single artifact, not the whole project"
        )
    project = release.project
    repo = get_repo(
        project=project,
        user=release.created_by,
        session=session,
        ttl=None,
        ref=release.git_rev,
    )
    return app.projects.get_contents_from_repo(
        project=project,
        repo=repo,
        path=path,
        ref=release.git_rev,
    )


@router.get(
    "/projects/{owner_name}/{project_name}/releases/{release_name}/comments"
)
def get_release_comments(
    owner_name: str,
    project_name: str,
    release_name: str,
    current_user: CurrentUserOptional,
    session: SessionDep,
    token: str | None = None,
) -> list[ReleaseCommentPublic]:
    release, _permission, _share = _authorize_release(
        session, owner_name, project_name, release_name, token, current_user
    )
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
            highlight=c.highlight,
            external_url=c.external_url,
            created=c.created,
        )
        for c in comments
    ]


@router.post(
    "/projects/{owner_name}/{project_name}/releases/{release_name}/comments"
)
def post_release_comment(
    owner_name: str,
    project_name: str,
    release_name: str,
    comment_in: ReleaseCommentPost,
    current_user: CurrentUserOptional,
    session: SessionDep,
    token: str | None = None,
) -> ReleaseCommentPublic:
    release, permission, share_token = _authorize_release(
        session, owner_name, project_name, release_name, token, current_user
    )
    if not release.comments_enabled:
        raise HTTPException(403, "Comments are disabled for this release")
    if permission not in ("comment", "manage"):
        raise HTTPException(403, "This link is view-only")
    # Identity is attribution only. Prefer the logged-in user, then the share
    # token's recipient email, then a name typed by an anonymous commenter.
    author_email = None
    if current_user is not None:
        author_name = (
            current_user.full_name or current_user.account.github_name
        )
        author_email = current_user.email
    else:
        author_email = share_token.email if share_token is not None else None
        author_name = (
            (comment_in.author_name or "").strip() or author_email or None
        )
    comment = ReleaseComment(
        release_id=release.id,
        user_id=current_user.id if current_user is not None else None,
        share_token_id=share_token.id if share_token is not None else None,
        author_name=author_name,
        author_email=author_email,
        git_rev=release.git_rev,
        comment=comment_in.comment,
        highlight=(
            comment_in.highlight.model_dump()
            if comment_in.highlight is not None
            else None
        ),
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
        highlight=comment.highlight,
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
    link = (
        f"{app_base}/{project.owner_account_name}/{project.name}"
        f"/releases/{release.name}"
    )
    author = comment.author_name or comment.author_email or "Anonymous"
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
