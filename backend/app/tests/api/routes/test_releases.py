"""Tests for app.api.routes.releases endpoints.

These exercise the wiring end to end (routing, models, the new tables, and
auth) against the migrated database. The authenticated create/view/comment
happy path requires a fully seeded project + repo and is covered separately.
"""

import uuid
from types import SimpleNamespace
from unittest.mock import patch

from app.config import settings
from app.models import ReleaseStaleness
from app.pipeline import StageStatus
from fastapi.testclient import TestClient


def test_get_release_view_unknown_project_returns_404(
    client: TestClient,
) -> None:
    resp = client.get(
        f"{settings.API_V1_STR}"
        "/projects/test-owner/test-project/releases/v1/view"
    )
    assert resp.status_code == 404


def test_get_release_contents_unknown_project_returns_404(
    client: TestClient,
) -> None:
    resp = client.get(
        f"{settings.API_V1_STR}"
        "/projects/test-owner/test-project/releases/v1/contents"
    )
    assert resp.status_code == 404


def test_get_release_comments_unknown_project_returns_404(
    client: TestClient,
) -> None:
    resp = client.get(
        f"{settings.API_V1_STR}"
        "/projects/test-owner/test-project/releases/v1/comments"
    )
    assert resp.status_code == 404


def test_post_release_comment_unknown_project_returns_404(
    client: TestClient,
) -> None:
    resp = client.post(
        f"{settings.API_V1_STR}"
        "/projects/test-owner/test-project/releases/v1/comments",
        json={"comment": "hello"},
    )
    assert resp.status_code == 404


def test_create_release_share_requires_auth(client: TestClient) -> None:
    resp = client.post(
        f"{settings.API_V1_STR}"
        "/projects/test-owner/test-project/releases/v1/shares",
        json={"permission": "comment"},
    )
    assert resp.status_code == 401


def test_list_release_shares_requires_auth(client: TestClient) -> None:
    resp = client.get(
        f"{settings.API_V1_STR}"
        "/projects/test-owner/test-project/releases/v1/shares"
    )
    assert resp.status_code == 401


def test_post_project_release_requires_auth(client: TestClient) -> None:
    resp = client.post(
        f"{settings.API_V1_STR}/projects/test-owner/test-project/releases",
        json={"name": "v0.1"},
    )
    assert resp.status_code == 401


def test_post_external_release_requires_auth(client: TestClient) -> None:
    resp = client.post(
        f"{settings.API_V1_STR}"
        "/projects/test-owner/test-project/releases/external",
        json={"name": "v1.0", "publisher": "arxiv"},
    )
    assert resp.status_code == 401


def test_import_github_releases_requires_auth(client: TestClient) -> None:
    resp = client.post(
        f"{settings.API_V1_STR}"
        "/projects/test-owner/test-project/releases/import-github"
    )
    assert resp.status_code == 401


def test_get_project_releases_unknown_project_returns_404(
    client: TestClient,
) -> None:
    # Listing is read-access (anonymous allowed for public projects), so an
    # unauthenticated request resolves the project first and 404s when missing.
    resp = client.get(
        f"{settings.API_V1_STR}/projects/test-owner/test-project/releases"
    )
    assert resp.status_code == 404


def test_get_project_releases_includes_calkit_yaml(
    client: TestClient,
) -> None:
    """Releases declared in calkit.yaml are surfaced to read-only viewers."""
    fake_project = SimpleNamespace(id=uuid.uuid4(), current_user_access="read")
    ck_info = {
        "releases": {
            "v0.1": {
                "kind": "project",
                "path": ".",
                "git_rev": "919e52021fa61b05546a36337638a8e8846220ac",
                "date": "2025-10-31",
                "doi": "10.22002/640bx-nbn45",
                "url": "https://doi.org/10.22002/640bx-nbn45",
            }
        }
    }
    with (
        patch(
            "app.api.routes.releases.app.projects.get_project",
            return_value=fake_project,
        ),
        patch(
            "app.api.routes.releases.get_repo",
            return_value=SimpleNamespace(),
        ),
        patch(
            "app.api.routes.releases.app.projects.get_ck_info_for_ref",
            return_value=ck_info,
        ),
    ):
        resp = client.get(
            f"{settings.API_V1_STR}/projects/test-owner/test-project/releases"
        )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    item = data[0]
    assert item["source"] == "calkit"
    assert item["name"] == "v0.1"
    # A missing ``public`` key means the release is public.
    assert item["public"] is True
    assert item["doi"] == "10.22002/640bx-nbn45"
    # Full SHA is abbreviated for display.
    assert item["git_rev_abbrev"] == "919e520"


def test_get_release_staleness_requires_auth(client: TestClient) -> None:
    resp = client.get(
        f"{settings.API_V1_STR}"
        "/projects/test-owner/test-project/releases/staleness?path=x.pdf"
    )
    assert resp.status_code == 401


def test_path_staleness_whole_project_not_gated() -> None:
    """Whole-project releases aren't evaluated for stage staleness."""
    from app.api.routes import releases

    res = releases._path_staleness(SimpleNamespace(), "abc123", ".", "o", "p")
    assert res.up_to_date is True
    assert res.stage is None


def test_path_staleness_no_producing_stage_not_gated() -> None:
    """A path no pipeline stage produces can't be stale -> not gated."""
    from app.api.routes import releases

    fake_tree = SimpleNamespace(
        is_file=lambda p: p == "dvc.lock",
        read_bytes=lambda p: b"stages: {}",
    )
    with (
        patch(
            "app.api.routes.releases.get_repo_tree_for_ref",
            return_value=fake_tree,
        ),
        patch(
            "app.api.routes.releases.find_stage_for_path", return_value=None
        ),
    ):
        res = releases._path_staleness(
            SimpleNamespace(), "abc123", "figs/x.png", "o", "p"
        )
    assert res.up_to_date is True
    assert res.stage is None


def test_path_staleness_stale_stage_flags_not_up_to_date() -> None:
    from app.api.routes import releases

    fake_tree = SimpleNamespace(
        is_file=lambda p: True, read_bytes=lambda p: b"stages: {}"
    )
    statuses = {
        "build-paper": StageStatus(
            status="stale", modified_inputs=["paper/paper.tex"]
        )
    }
    with (
        patch(
            "app.api.routes.releases.get_repo_tree_for_ref",
            return_value=fake_tree,
        ),
        patch(
            "app.api.routes.releases.find_stage_for_path",
            return_value="build-paper",
        ),
        patch(
            "app.api.routes.releases.compute_stage_statuses",
            return_value=statuses,
        ),
        patch("app.api.routes.releases.get_object_fs", return_value=None),
    ):
        res = releases._path_staleness(
            SimpleNamespace(), "abc123", "paper/paper.pdf", "o", "p"
        )
    assert res.up_to_date is False
    assert res.status == "stale"
    assert res.stage == "build-paper"
    assert res.modified_inputs == ["paper/paper.tex"]


def test_hash_share_token_is_sha256_and_not_identity() -> None:
    """Share tokens are stored as a SHA-256 hash, never in the clear."""
    import hashlib

    from app.api.routes import releases

    raw = "super-secret-token"
    hashed = releases._hash_share_token(raw)
    assert hashed == hashlib.sha256(raw.encode()).hexdigest()
    assert hashed != raw
    assert len(hashed) == 64
    # Deterministic so lookups by hash work.
    assert releases._hash_share_token(raw) == hashed


def _share_email_fixtures():
    project = SimpleNamespace(owner_account_name="test-owner", name="proj")
    release = SimpleNamespace(name="v1.0")
    token = SimpleNamespace(
        email="reviewer@example.com", permission="comment", note=None
    )
    user = SimpleNamespace(full_name="Alice", email="alice@example.com")
    return project, release, token, user


def test_send_share_email_skips_when_not_configured() -> None:
    """No SMTP config -> no send, returns False, creation still succeeds."""
    from app.api.routes import releases

    project, release, token, user = _share_email_fixtures()
    with (
        patch.object(settings, "SMTP_HOST", None),
        patch("app.api.routes.releases.messaging.send_email") as send,
    ):
        sent = releases._send_share_email(project, release, token, "RAW", user)
    assert sent is False
    send.assert_not_called()


def test_send_share_email_skips_without_recipient() -> None:
    """A link with no recipient email is never emailed, even if configured."""
    from app.api.routes import releases

    project, release, token, user = _share_email_fixtures()
    token.email = None
    with (
        patch.object(settings, "SMTP_HOST", "smtp.example.com"),
        patch.object(settings, "EMAILS_FROM_EMAIL", "from@example.com"),
        patch("app.api.routes.releases.messaging.send_email") as send,
    ):
        sent = releases._send_share_email(project, release, token, "RAW", user)
    assert sent is False
    send.assert_not_called()


def test_send_share_email_sends_link_with_token() -> None:
    """When configured, the invite is sent and embeds the token link."""
    from app.api.routes import releases

    project, release, token, user = _share_email_fixtures()
    with (
        patch.object(settings, "SMTP_HOST", "smtp.example.com"),
        patch.object(settings, "EMAILS_FROM_EMAIL", "from@example.com"),
        patch("app.api.routes.releases.messaging.send_email") as send,
    ):
        sent = releases._send_share_email(project, release, token, "RAW", user)
    assert sent is True
    send.assert_called_once()
    kwargs = send.call_args.kwargs
    assert kwargs["email_to"] == "reviewer@example.com"
    assert "?token=RAW" in kwargs["html_content"]
    assert "v1.0" in kwargs["html_content"]


def test_send_share_email_swallows_send_failure() -> None:
    """A transport error doesn't fail share creation -- it returns False."""
    from app.api.routes import releases

    project, release, token, user = _share_email_fixtures()
    with (
        patch.object(settings, "SMTP_HOST", "smtp.example.com"),
        patch.object(settings, "EMAILS_FROM_EMAIL", "from@example.com"),
        patch(
            "app.api.routes.releases.messaging.send_email",
            side_effect=RuntimeError("smtp down"),
        ),
    ):
        sent = releases._send_share_email(project, release, token, "RAW", user)
    assert sent is False


def test_post_project_release_blocks_non_reproducible(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    tmp_path,
) -> None:
    """A stale artifact is rejected with 409 unless acknowledged."""
    fake_project = SimpleNamespace(
        id=uuid.uuid4(), owner_account_name="test-owner", name="test-project"
    )

    class _FakeTree:
        def __truediv__(self, other):
            return object()

    fake_commit = SimpleNamespace(hexsha="a" * 40, tree=_FakeTree())
    # An empty working dir (no calkit.yaml) makes the re-release guard a no-op,
    # so the request reaches the staleness check this test targets.
    fake_repo = SimpleNamespace(
        commit=lambda ref: fake_commit,
        head=SimpleNamespace(commit=fake_commit),
        tags=[],
        working_dir=str(tmp_path),
    )
    stale = ReleaseStaleness(
        path="paper/paper.pdf",
        stage="build-paper",
        status="stale",
        up_to_date=False,
    )
    with (
        patch(
            "app.api.routes.releases.app.projects.get_project",
            return_value=fake_project,
        ),
        patch("app.api.routes.releases.get_repo", return_value=fake_repo),
        patch("app.api.routes.releases._path_staleness", return_value=stale),
    ):
        resp = client.post(
            f"{settings.API_V1_STR}/projects/test-owner/test-project/releases",
            json={"name": "v0.1", "path": "paper/paper.pdf"},
            headers=normal_user_token_headers,
        )
    assert resp.status_code == 409
    assert "reproducible" in resp.json()["detail"].lower()
