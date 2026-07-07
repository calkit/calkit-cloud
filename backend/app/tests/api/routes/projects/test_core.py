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


def test_get_project_content_paths_merges_git_and_dvc(
    client: TestClient,
) -> None:
    fake_project = SimpleNamespace()
    fake_repo = SimpleNamespace(
        git=SimpleNamespace(
            ls_files=lambda: (
                "README.md\nfigs/plot.png.dvc\n.dvc/config\nscripts/run.py"
            )
        )
    )
    dvc_outs = {"figs/plot.png": {"type": "file"}, "data": {"type": "dir"}}
    with (
        patch(
            "app.api.routes.projects.core.app.projects.get_project",
            return_value=fake_project,
        ),
        patch("app.api.routes.projects.core.get_repo", return_value=fake_repo),
        patch(
            "app.api.routes.projects.core.app.projects.get_repo_tree_for_ref",
            return_value=SimpleNamespace(),
        ),
        patch(
            "app.api.routes.projects.core.app.projects"
            ".get_ck_info_and_dvc_outs_from_tree",
            return_value=({}, dvc_outs, {}),
        ),
    ):
        response = client.get(
            f"{settings.API_V1_STR}"
            "/projects/test-owner/test-project/contents-paths"
        )
    assert response.status_code == 200
    paths = response.json()
    # DVC output's real path is included; its .dvc pointer is dropped.
    assert "figs/plot.png" in paths
    assert "figs/plot.png.dvc" not in paths
    # .dvc internals and DVC dir outputs are excluded; plain git files kept.
    assert ".dvc/config" not in paths
    assert "data" not in paths
    assert "README.md" in paths
    assert "scripts/run.py" in paths
    # Sorted for stable display.
    assert paths == sorted(paths)


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
    # Titles must use sentence case (only first letter capitalized, not title
    # case where every word is capitalized).
    for fig in returned_figures:
        title = fig["title"]
        assert title == title[0].upper() + title[1:], (
            f"Title {title!r} is not in sentence case"
        )
        # No word after the first should be capitalized solely due to title()
        words = title.split()
        if len(words) > 1:
            assert not all(w[0].isupper() for w in words[1:] if w), (
                f"Title {title!r} appears to use title case, not sentence case"
            )


def test_get_project_figures_autodetects_dvc_stored(
    client: TestClient,
) -> None:
    """Figures stored with DVC (in dvc_lock_outs) must be auto-detected."""
    fake_project = SimpleNamespace(id="00000000-0000-0000-0000-000000000001")
    fake_tree = SimpleNamespace()
    fake_repo = SimpleNamespace()
    # Repo has no git-tracked blobs
    fake_commit = SimpleNamespace()
    fake_commit.tree = SimpleNamespace(traverse=lambda: iter([]))
    fake_repo.head = SimpleNamespace(commit=fake_commit)
    # DVC lock outs contain figure files and non-figure files
    dvc_detected_paths = [
        "figures/plot.png",
        "results/figures/result.png",
    ]
    dvc_ignored_paths = [
        "data/output.png",  # not in a figure dir
        "figures/plot.txt",  # unsupported extension
    ]
    dvc_lock_outs = {}
    for p in dvc_detected_paths + dvc_ignored_paths:
        dvc_lock_outs[p] = {"path": p, "md5": "abc123", "type": "file"}
    # Add a dir entry that must be skipped
    dvc_lock_outs["figures"] = {"path": "figures", "type": "dir"}
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
            return_value=({}, dvc_lock_outs, {}),
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
    for path in dvc_detected_paths:
        assert path in returned_paths, (
            f"Expected DVC path {path!r} to be detected"
        )
    for path in dvc_ignored_paths:
        assert path not in returned_paths, (
            f"Expected DVC path {path!r} to be ignored"
        )
    # Dir entry must not appear
    assert "figures" not in returned_paths


def test_get_project_figures_dvc_no_duplicates_with_git(
    client: TestClient,
) -> None:
    """A figure tracked in both git tree and DVC lock outs must appear once."""
    fake_project = SimpleNamespace(id="00000000-0000-0000-0000-000000000001")
    fake_tree = SimpleNamespace()
    shared_path = "figures/shared.png"
    fake_blob = _make_fake_blob(shared_path)
    fake_commit = SimpleNamespace()
    fake_commit.tree = SimpleNamespace(traverse=lambda: iter([fake_blob]))
    fake_repo = SimpleNamespace()
    fake_repo.head = SimpleNamespace(commit=fake_commit)
    # Same path also appears in dvc_lock_outs
    dvc_lock_outs = {
        shared_path: {"path": shared_path, "md5": "abc123", "type": "file"},
    }
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
            return_value=({}, dvc_lock_outs, {}),
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
    paths = [fig["path"] for fig in returned_figures]
    assert paths.count(shared_path) == 1, (
        f"Expected {shared_path!r} to appear exactly once, got {paths}"
    )


def test_get_project_figures_autodetects_dvc_pointer_files(
    client: TestClient,
) -> None:
    """Figures stored via standalone .dvc pointer files must be auto-detected.

    When a blob ending in '.dvc' is found in the git tree (e.g.
    'figures/plot.png.dvc'), the derived path ('figures/plot.png') should be
    checked and added as a figure if it passes the extension/directory filter.
    """
    fake_project = SimpleNamespace(id="00000000-0000-0000-0000-000000000001")
    fake_tree = SimpleNamespace()
    fake_repo = SimpleNamespace()
    # Blobs that are .dvc pointer files whose derived paths are figures
    dvc_pointer_detected = [
        "figures/plot.png",
        "results/figures/result.pdf",
    ]
    # .dvc pointer files whose derived paths are NOT figures
    dvc_pointer_ignored = [
        "data/output.png",  # not in a figure dir
        "figures/data.txt",  # unsupported extension
    ]
    # Build fake blobs: use the .dvc pointer file paths
    blobs = [_make_fake_blob(p + ".dvc") for p in dvc_pointer_detected] + [
        _make_fake_blob(p + ".dvc") for p in dvc_pointer_ignored
    ]
    fake_commit = SimpleNamespace()
    fake_commit.tree = SimpleNamespace(traverse=lambda: iter(blobs))
    fake_repo.head = SimpleNamespace(commit=fake_commit)
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
    for path in dvc_pointer_detected:
        assert path in returned_paths, (
            f"Expected .dvc-pointer-tracked figure {path!r} to be detected"
        )
    for path in dvc_pointer_ignored:
        assert path not in returned_paths, (
            f"Expected .dvc-pointer-tracked non-figure {path!r} to be ignored"
        )
    # The .dvc pointer files themselves must not appear as figures
    for path in dvc_pointer_detected + dvc_pointer_ignored:
        assert path + ".dvc" not in returned_paths, (
            f"Pointer file {path + '.dvc'!r} must not appear as a figure"
        )


def test_get_project_figures_dvc_pointer_no_duplicates_with_dvc_lock(
    client: TestClient,
) -> None:
    """A figure in both dvc_lock_outs and a .dvc pointer blob must appear once.

    If a path is already in dvc_lock_outs (pipeline output), encountering the
    corresponding .dvc blob in the git tree must not produce a duplicate.
    """
    fake_project = SimpleNamespace(id="00000000-0000-0000-0000-000000000001")
    fake_tree = SimpleNamespace()
    shared_path = "figures/shared.png"
    # Git tree contains a .dvc pointer blob for the same figure
    fake_blob = _make_fake_blob(shared_path + ".dvc")
    fake_commit = SimpleNamespace()
    fake_commit.tree = SimpleNamespace(traverse=lambda: iter([fake_blob]))
    fake_repo = SimpleNamespace()
    fake_repo.head = SimpleNamespace(commit=fake_commit)
    # Same path also appears in dvc_lock_outs (pipeline output)
    dvc_lock_outs = {
        shared_path: {"path": shared_path, "md5": "abc123", "type": "file"},
    }
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
            return_value=({}, dvc_lock_outs, {}),
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
    returned_paths = [fig["path"] for fig in returned_figures]
    assert returned_paths.count(shared_path) == 1, (
        f"Expected {shared_path!r} to appear exactly once, got {returned_paths}"
    )


def test_get_project_pipeline_reads_at_ref(client: TestClient) -> None:
    """The pipeline endpoint must read files at the requested ref.

    get_repo only fetches a ref; it never checks it out, so reading from
    the working tree would silently return the default branch's pipeline.
    The endpoint must therefore read through get_repo_tree_for_ref.
    """
    fake_project = SimpleNamespace()
    fake_repo = SimpleNamespace()

    files = {
        "dvc.yaml": "stages:\n  train:\n    cmd: python train.py\n",
    }

    class FakeTree:
        def is_file(self, path: str) -> bool:
            return path in files

        def read_text(self, path: str, encoding: str = "utf-8") -> str:
            return files[path]

    fake_tree = FakeTree()

    with (
        patch(
            "app.api.routes.projects.core.app.projects.get_project",
            return_value=fake_project,
        ),
        patch(
            "app.api.routes.projects.core.get_repo",
            return_value=fake_repo,
        ) as mock_get_repo,
        patch(
            "app.api.routes.projects.core.app.projects.get_repo_tree_for_ref",
            return_value=fake_tree,
        ) as mock_get_tree,
    ):
        response = client.get(
            f"{settings.API_V1_STR}/projects/test-owner/test-project/pipeline"
            "?ref=some-branch"
        )

    assert response.status_code == 200
    body = response.json()
    assert "train" in body["dvc_stages"]
    # The ref must be forwarded to get_repo so the branch is fetched
    assert mock_get_repo.call_args.kwargs["ref"] == "some-branch"
    # ...and to get_repo_tree_for_ref so files are read at that snapshot
    # rather than from the live working-tree checkout
    mock_get_tree.assert_called_once_with(fake_repo, "some-branch")


class _EmptyTree:
    """A repo tree with no files (defeats auto-detection in tests)."""

    def traverse(self):
        return []


def _ref_aware_endpoint_reads_declared_at_ref(
    client: TestClient, endpoint: str, ck_key: str
) -> None:
    """Shared assertions: declared metadata + pipeline read at the ref.

    get_repo only fetches a ref, it does not check it out, so the declared
    publications/presentations list and the DVC pipeline must be read via
    the ref-aware helpers rather than the live working tree.
    """
    fake_project = SimpleNamespace(owner_account_name="o", name="p")
    fake_repo = SimpleNamespace(
        working_dir="/tmp/nonexistent",
        commit=lambda _ref: SimpleNamespace(tree=_EmptyTree()),
        head=SimpleNamespace(commit=SimpleNamespace(tree=_EmptyTree())),
    )
    declared = [{"path": f"declared/from-{ck_key}.pdf", "title": "Declared"}]

    with (
        patch(
            "app.api.routes.projects.core.app.projects.get_project",
            return_value=fake_project,
        ),
        patch(
            "app.api.routes.projects.core.get_repo",
            return_value=fake_repo,
        ) as mock_get_repo,
        patch(
            "app.api.routes.projects.core.app.projects.get_ck_info_for_ref",
            return_value={ck_key: [dict(d) for d in declared]},
        ) as mock_ck_for_ref,
        patch(
            "app.api.routes.projects.core.app.projects"
            ".get_dvc_pipeline_for_ref",
            return_value={},
        ) as mock_pipeline_for_ref,
        patch(
            "app.api.routes.projects.core.app.projects.get_repo_tree_for_ref",
            return_value=object(),
        ),
        patch(
            "app.api.routes.projects.core.app.projects"
            ".get_ck_info_and_dvc_outs_from_tree",
            return_value=({}, {}, {}),
        ),
        patch(
            "app.api.routes.projects.core.app.projects.get_contents_from_tree",
            return_value=ContentsItem(
                name="x",
                path="x",
                type="file",
                size=1,
                in_repo=True,
                content=None,
                url=None,
                storage=None,
                dir_items=None,
            ),
        ),
        patch(
            "app.api.routes.projects.core.calkit.overleaf.get_sync_info",
            return_value={},
        ),
    ):
        response = client.get(
            f"{settings.API_V1_STR}/projects/test-owner/test-project/"
            f"{endpoint}?ref=some-branch"
        )

    assert response.status_code == 200, response.text
    paths = [item["path"] for item in response.json()]
    assert f"declared/from-{ck_key}.pdf" in paths
    assert mock_get_repo.call_args.kwargs["ref"] == "some-branch"
    # Declared metadata and the DVC pipeline must come from the ref, not
    # the working tree
    assert mock_ck_for_ref.call_args.kwargs["ref"] == "some-branch"
    pipeline_args = mock_pipeline_for_ref.call_args
    assert (pipeline_args.args + tuple(pipeline_args.kwargs.values()))[
        -1
    ] == "some-branch"


def test_get_project_publications_reads_declared_at_ref(
    client: TestClient,
) -> None:
    _ref_aware_endpoint_reads_declared_at_ref(
        client, "publications", "publications"
    )


def test_get_project_presentations_reads_declared_at_ref(
    client: TestClient,
) -> None:
    _ref_aware_endpoint_reads_declared_at_ref(
        client, "presentations", "presentations"
    )


def test_get_project_results_autodetects_and_reads_ref(
    client: TestClient,
) -> None:
    """Results under a results-style dir are auto-detected, and declared
    results plus the tree are read at the requested ref."""
    fake_project = SimpleNamespace(id="00000000-0000-0000-0000-000000000002")
    detected_paths = [
        "results/summary.json",
        "results/data.csv",
        "results/deep/nested/out.parquet",
        "result/single.yaml",
    ]
    ignored_paths = [
        "data/output.csv",  # parent dir not a results dir
        "summary.json",  # no results directory at all
        ".results/hidden.json",  # hidden directory
        "results/plot.png",  # not a result extension
    ]
    blobs = [_make_fake_blob(p) for p in detected_paths + ignored_paths]
    fake_commit = SimpleNamespace(
        tree=SimpleNamespace(traverse=lambda: iter(blobs))
    )
    fake_repo = SimpleNamespace(
        commit=lambda _ref: fake_commit,
        head=SimpleNamespace(commit=fake_commit),
    )
    with (
        patch(
            "app.api.routes.projects.core.app.projects.get_project",
            return_value=fake_project,
        ),
        patch(
            "app.api.routes.projects.core.get_repo",
            return_value=fake_repo,
        ) as mock_get_repo,
        patch(
            "app.api.routes.projects.core.app.projects.get_ck_info_for_ref",
            return_value={},
        ) as mock_ck_for_ref,
        patch(
            "app.api.routes.projects.core.app.projects.get_repo_tree_for_ref",
            return_value=object(),
        ),
        patch(
            "app.api.routes.projects.core.app.projects"
            ".get_ck_info_and_dvc_outs_from_tree",
            return_value=({}, {}, {}),
        ),
    ):
        response = client.get(
            f"{settings.API_V1_STR}/projects/test-owner/test-project/results"
            "?ref=some-branch"
        )
    assert response.status_code == 200, response.text
    paths = {res["path"] for res in response.json()}
    for path in detected_paths:
        assert path in paths, f"Expected {path!r} to be detected"
    for path in ignored_paths:
        assert path not in paths, f"Expected {path!r} to be ignored"
    assert mock_get_repo.call_args.kwargs["ref"] == "some-branch"
    assert mock_ck_for_ref.call_args.kwargs["ref"] == "some-branch"


def test_question_text_handles_string_and_object() -> None:
    from app.api.routes.projects.core import _question_text

    assert _question_text("Plain question?") == "Plain question?"
    assert _question_text({"question": "Rich?", "hypothesis": "h"}) == "Rich?"
    assert _question_text({}) == ""


def test_build_question_evidence_resolves_figures_and_results() -> None:
    from app.api.routes.projects.core import _build_question_evidence
    from app.models.core import Figure, Result

    fig = Figure(path="figures/x.png", title="X")
    res = Result(path="results/summary.json", title="Summary")
    evidence_ck = [
        {"kind": "figure", "path": "figures/x.png", "explanation": "shows x"},
        {"kind": "result", "path": "results/summary.json", "key": "mean"},
        {"kind": "figure", "path": "figures/missing.png"},
        {"kind": "bogus", "path": "whatever"},  # unknown kind, skipped
        "not-a-dict",  # skipped
    ]
    evidence = _build_question_evidence(
        evidence_ck, {fig.path: fig}, {res.path: res}
    )
    assert len(evidence) == 3
    assert evidence[0].kind == "figure"
    assert evidence[0].figure is not None
    assert evidence[0].figure.path == "figures/x.png"
    assert evidence[0].explanation == "shows x"
    assert evidence[1].kind == "result"
    assert evidence[1].result is not None
    assert evidence[1].result.title == "Summary"
    assert evidence[1].key == "mean"
    # An unresolved figure path leaves the resolved figure as None.
    assert evidence[2].figure is None
