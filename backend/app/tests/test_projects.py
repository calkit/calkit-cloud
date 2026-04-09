"""Tests for app.projects."""

import base64
import uuid
from pathlib import Path

import git

import app.projects
from app.models import Account, Project


def _make_project() -> Project:
    account = Account(
        id=uuid.uuid4(),
        name="owneracct",
        github_name="ownergh",
        user_id=uuid.uuid4(),
    )
    return Project(
        id=uuid.uuid4(),
        name="project-name",
        title="Project Name",
        git_repo_url="https://github.com/ownergh/project-name",
        owner_account_id=account.id,
        owner_account=account,
    )


def _init_repo(repo_dir: Path) -> tuple[git.Repo, str]:
    repo = git.Repo.init(repo_dir)
    repo.git.config(["user.name", "CI Test"])
    repo.git.config(["user.email", "ci-test@example.com"])
    notes = repo_dir / "notes.txt"
    notes.write_text("version-one\n")
    repo.git.add(["notes.txt"])
    repo.git.commit(["-m", "Add v1 notes"])
    ref_v1 = repo.head.commit.hexsha
    notes.write_text("version-two\n")
    (repo_dir / "new-file.txt").write_text("new\n")
    repo.git.add(["notes.txt", "new-file.txt"])
    repo.git.commit(["-m", "Update notes and add new file"])
    return repo, ref_v1


def test_get_contents_from_repo_at_given_ref(tmp_path, monkeypatch):
    # Keep this test focused on Git ref behavior, not DVC/object storage.
    monkeypatch.setattr(
        app.projects, "expand_dvc_lock_outs", lambda *a, **k: {}
    )
    project = _make_project()
    repo, ref_v1 = _init_repo(tmp_path / "repo")
    item_latest = app.projects.get_contents_from_repo(
        project=project,
        repo=repo,
        path="notes.txt",
    )
    assert item_latest.content is not None
    assert (
        base64.b64decode(item_latest.content).decode().strip() == "version-two"
    )
    item_v1 = app.projects.get_contents_from_repo(
        project=project,
        repo=repo,
        path="notes.txt",
        ref=ref_v1,
    )
    assert item_v1.content is not None
    assert base64.b64decode(item_v1.content).decode().strip() == "version-one"
    root_latest = app.projects.get_contents_from_repo(
        project=project, repo=repo
    )
    latest_names = {item.name for item in (root_latest.dir_items or [])}
    assert "new-file.txt" in latest_names
    root_v1 = app.projects.get_contents_from_repo(
        project=project, repo=repo, ref=ref_v1
    )
    v1_names = {item.name for item in (root_v1.dir_items or [])}
    assert "new-file.txt" not in v1_names
