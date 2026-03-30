from types import SimpleNamespace
from unittest.mock import ANY, patch

from app.config import settings
from fastapi.testclient import TestClient


def test_get_project_contents_forwards_ref(client: TestClient) -> None:
    fake_project = SimpleNamespace()
    fake_repo = SimpleNamespace()

    with (
        patch(
            "app.api.routes.projects.core.app.projects.get_project",
            return_value=fake_project,
        ) as mock_get_project,
        patch(
            "app.api.routes.projects.core.get_repo",
            return_value=fake_repo,
        ) as mock_get_repo,
        patch(
            "app.api.routes.projects.core.app.projects.get_contents_from_repo",
            return_value={
                "name": "README.md",
                "path": "README.md",
                "type": "file",
                "size": 12,
                "in_repo": True,
                "content": "hello world\n",
                "dir_items": None,
            },
        ) as mock_get_contents,
    ):
        response = client.get(
            (
                f"{settings.API_V1_STR}/projects/test-owner/test-project/contents"
                "?path=README.md&ref=v1.2.3"
            )
        )

    assert response.status_code == 200
    assert response.json()["path"] == "README.md"

    mock_get_project.assert_called_once_with(
        owner_name="test-owner",
        project_name="test-project",
        session=ANY,
        current_user=None,
        min_access_level="read",
    )

    assert mock_get_repo.call_count == 1
    repo_call = mock_get_repo.call_args.kwargs
    assert repo_call["project"] is fake_project
    assert repo_call["user"] is None
    assert repo_call["session"] is not None
    assert repo_call["ttl"] is not None
    assert repo_call["ref"] == "v1.2.3"

    assert mock_get_contents.call_count == 1
    contents_call = mock_get_contents.call_args.kwargs
    assert contents_call["project"] is fake_project
    assert contents_call["repo"] is fake_repo
    assert contents_call["path"] == "README.md"
    assert contents_call["ref"] == "v1.2.3"


def test_get_project_file_history_endpoint(client: TestClient) -> None:
    fake_project = SimpleNamespace()
    fake_repo = SimpleNamespace()
    fake_history = [
        {
            "hash": "abc" * 13 + "abcd",
            "short_hash": "abc1234",
            "message": "Update figure\n",
            "author": "Test User",
            "author_email": "test@example.com",
            "timestamp": "2026-01-01T00:00:00+00:00",
            "committed_date": 1735689600,
            "parent_hashes": [],
            "summary": "Update figure",
        }
    ]

    with (
        patch(
            "app.api.routes.projects.core.app.projects.get_project",
            return_value=fake_project,
        ),
        patch(
            "app.api.routes.projects.core.get_repo",
            return_value=fake_repo,
        ),
        patch(
            "app.api.routes.projects.core.app.git.get_file_history"
            if False
            else "app.git.get_file_history",
            return_value=fake_history,
        ),
    ):
        response = client.get(
            f"{settings.API_V1_STR}/projects/test-owner/test-project"
            "/git/file-history?path=figures/my-figure.png"
        )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["short_hash"] == "abc1234"


def test_get_project_file_history_rejects_absolute_path(
    client: TestClient,
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/projects/test-owner/test-project"
        "/git/file-history?path=/etc/passwd"
    )
    assert response.status_code == 400


def test_get_project_file_history_rejects_traversal(
    client: TestClient,
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/projects/test-owner/test-project"
        "/git/file-history?path=../secrets.txt"
    )
    assert response.status_code == 400
