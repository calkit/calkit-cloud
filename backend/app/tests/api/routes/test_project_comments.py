"""Tests for project comment endpoints."""

from types import SimpleNamespace
from unittest.mock import patch

from app.api.routes.projects.core import get_project_comments


def test_get_project_comments_uses_all_results() -> None:
    fake_project = SimpleNamespace(id="project-id")
    fake_comment = SimpleNamespace(id="comment-id")

    class ExecResult:
        def __init__(self) -> None:
            self.all_called = False

        def all(self):
            self.all_called = True
            return [fake_comment]

    class FakeSession:
        def __init__(self) -> None:
            self.exec_result = ExecResult()

        def exec(self, _query):
            return self.exec_result

    session = FakeSession()

    with (
        patch(
            "app.api.routes.projects.core.app.projects.get_project",
            return_value=fake_project,
        ),
        patch(
            "app.api.routes.projects.core._sync_github_issue_resolutions"
        ) as mock_sync,
    ):
        comments = get_project_comments(
            owner_name="test-owner",
            project_name="test-project",
            current_user=None,
            session=session,
            artifact_type="publication",
            artifact_path="paper/main.pdf",
        )

    assert session.exec_result.all_called is True
    assert comments == [fake_comment]
    mock_sync.assert_called_once_with(session, [fake_comment], None)
