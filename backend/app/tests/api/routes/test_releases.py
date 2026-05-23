"""Tests for app.api.routes.releases endpoints.

These exercise the wiring end to end (routing, models, the new tables, and
auth) against the migrated database. The authenticated create/view/comment
happy path requires a fully seeded project + repo and is covered separately.
"""

import uuid
from types import SimpleNamespace
from unittest.mock import patch

from app.config import settings
from fastapi.testclient import TestClient


def test_get_release_invalid_token_returns_404(client: TestClient) -> None:
    resp = client.get(f"{settings.API_V1_STR}/releases/does-not-exist-token")
    assert resp.status_code == 404


def test_get_release_comments_invalid_token_returns_404(
    client: TestClient,
) -> None:
    resp = client.get(
        f"{settings.API_V1_STR}/releases/does-not-exist-token/comments"
    )
    assert resp.status_code == 404


def test_post_release_comment_invalid_token_returns_404(
    client: TestClient,
) -> None:
    resp = client.post(
        f"{settings.API_V1_STR}/releases/does-not-exist-token/comments",
        json={"comment": "hello"},
    )
    assert resp.status_code == 404


def test_post_project_release_requires_auth(client: TestClient) -> None:
    resp = client.post(
        f"{settings.API_V1_STR}/projects/test-owner/test-project/releases",
        json={"name": "v0.1"},
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
    fake_project = SimpleNamespace(
        id=uuid.uuid4(), current_user_access="read"
    )
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
