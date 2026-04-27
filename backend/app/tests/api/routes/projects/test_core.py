"""Tests for app.api.routes.projects.core endpoints."""

from types import SimpleNamespace
from unittest.mock import ANY, patch

from app.api.routes.projects.core import get_project_comments
from app.config import settings
from app.models.core import ContentsItem
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
    # The API route must forward the selected ref to repo/content helpers
    assert mock_get_repo.call_count == 1
    repo_call = mock_get_repo.call_args.kwargs
    assert repo_call["project"] is fake_project
    assert repo_call["user"] is None
    assert repo_call["session"] is not None
    assert repo_call["ttl"] is not None
    assert repo_call["ref"] == "v1.2.3"
    # The ref must also be forwarded to get_contents_from_repo so it reads
    # the file tree at the requested snapshot, not the current HEAD
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
            "app.api.routes.projects.core.get_file_history",
            return_value=fake_history,
        ),
    ):
        response = client.get(
            f"{settings.API_V1_STR}/projects/test-owner/test-project"
            "/git/file-history?path=figures/my-figure.png"
        )
    assert response.status_code == 200
    # Endpoint should proxy through the git history payload unchanged
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


def test_project_routes_are_case_insensitive(client: TestClient) -> None:
    fake_project = SimpleNamespace(is_public=True)
    fake_repo = SimpleNamespace()
    with (
        patch(
            "app.api.routes.projects.core.app.projects.get_project",
            return_value=fake_project,
        ) as mock_get_project,
        patch(
            "app.api.routes.projects.core.get_repo",
            return_value=fake_repo,
        ),
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
        ),
    ):
        response = client.get(
            f"{settings.API_V1_STR}/projects/MyOrg/My-Project/contents"
            "?path=README.md"
        )
    assert response.status_code == 200
    mock_get_project.assert_called_once_with(
        owner_name="MyOrg",
        project_name="My-Project",
        session=ANY,
        current_user=None,
        min_access_level="read",
    )


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
            session=session,  # type: ignore
            artifact_type="publication",
            artifact_path="paper/main.pdf",
        )
    assert session.exec_result.all_called is True
    assert comments == [fake_comment]
    mock_sync.assert_called_once_with(session, [fake_comment], None)


def _make_fake_blob(path: str) -> SimpleNamespace:
    """Return a minimal git blob-like object for auto-detection tests."""
    return SimpleNamespace(type="blob", path=path)


def test_get_project_figures_autodetects_deeply_nested(
    client: TestClient,
) -> None:
    """Figures inside a 'figures' dir at any depth must be auto-detected."""
    fake_project = SimpleNamespace(id="00000000-0000-0000-0000-000000000001")
    fake_tree = SimpleNamespace()
    # Blobs that should be detected: file is inside a 'figures' directory
    # at various depths.
    detected_paths = [
        "figures/plot.png",  # direct child
        "results/figures/plot.png",  # one extra level
        "figures/something/else/55/fig.png",  # deeply nested
        "publications/paper1/figures/result.png",  # publications sub-tree
    ]
    # Blobs that must NOT be detected.
    ignored_paths = [
        "data/output.png",  # parent dir not in FIGURE_DIRS
        "plot.png",  # no parent directory at all
        ".calkit/figures/hidden.png",  # hidden directory
        "figures/plot.txt",  # unsupported extension
    ]
    blobs = [_make_fake_blob(p) for p in detected_paths + ignored_paths]
    fake_commit = SimpleNamespace()
    fake_commit.tree = SimpleNamespace(traverse=lambda: iter(blobs))
    fake_repo = SimpleNamespace()
    fake_repo.head = SimpleNamespace(commit=fake_commit)
    # fake_contents is returned by the mocked get_contents_from_tree for each
    # auto-detected figure, providing the content/url/storage fields the
    # endpoint attaches to every figure dict.
    fake_contents = ContentsItem(
        name="fig",
        path="fig",
        type="file",
        size=0,
        in_repo=True,
        content=None,
        url=None,
        storage=None,
    )
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
            "app.api.routes.projects.core.app.projects.get_ck_info_for_ref",
            return_value={},
        ),
        patch(
            "app.api.routes.projects.core.app.projects.get_repo_tree_for_ref",
            return_value=fake_tree,
        ),
        patch(
            "app.api.routes.projects.core.app.projects.get_ck_info_and_dvc_outs_from_tree",
            return_value=({}, {}, {}),
        ),
        patch(
            "app.api.routes.projects.core.app.projects.get_contents_from_tree",
            return_value=fake_contents,
        ),
    ):
        response = client.get(
            f"{settings.API_V1_STR}/projects/test-owner/test-project/figures"
        )
    assert response.status_code == 200
    returned_figures = response.json()
    returned_paths = {fig["path"] for fig in returned_figures}
    for path in detected_paths:
        assert path in returned_paths, f"Expected {path!r} to be detected"
    for path in ignored_paths:
        assert path not in returned_paths, f"Expected {path!r} to be ignored"
    # Titles must use sentence case (only first letter capitalised, not title
    # case where every word is capitalised).
    for fig in returned_figures:
        title = fig["title"]
        assert title == title[0].upper() + title[1:], (
            f"Title {title!r} is not in sentence case"
        )
        # No word after the first should be capitalised solely due to title()
        words = title.split()
        if len(words) > 1:
            assert not all(w[0].isupper() for w in words[1:] if w), (
                f"Title {title!r} appears to use title case, not sentence case"
            )
