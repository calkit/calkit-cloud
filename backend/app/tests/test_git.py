"""Tests for app.git."""

import uuid
from pathlib import Path

import git

import app.git
import app.projects
from app.models import Account, Project


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


def test_get_file_history_git_tracked(tmp_path, monkeypatch):
    """get_file_history returns commits that touched the given file."""
    monkeypatch.setattr(
        app.projects, "expand_dvc_lock_outs", lambda *a, **k: {}
    )
    _, ref_v1 = _init_repo(tmp_path / "repo")
    repo = git.Repo(tmp_path / "repo")
    history = app.git.get_file_history(repo, path="notes.txt")
    # notes.txt was changed in both commits
    assert len(history) >= 2
    hashes = [c["short_hash"] for c in history]
    assert ref_v1[:7] in hashes
    # Entries are newest-first
    assert history[0]["committed_date"] >= history[-1]["committed_date"]


def test_get_file_history_missing_file(tmp_path, monkeypatch):
    """get_file_history returns an empty list for a file with no history."""
    monkeypatch.setattr(
        app.projects, "expand_dvc_lock_outs", lambda *a, **k: {}
    )
    _init_repo(tmp_path / "repo")
    repo = git.Repo(tmp_path / "repo")
    history = app.git.get_file_history(repo, path="nonexistent.txt")
    assert history == []


def test_get_file_history_dvc_pointer(tmp_path, monkeypatch):
    """get_file_history finds commits via a .dvc pointer file."""
    monkeypatch.setattr(
        app.projects, "expand_dvc_lock_outs", lambda *a, **k: {}
    )
    repo_dir = tmp_path / "repo"
    repo = git.Repo.init(repo_dir)
    repo.git.config(["user.name", "CI Test"])
    repo.git.config(["user.email", "ci-test@example.com"])

    # Simulate a DVC-tracked file: only the .dvc pointer is in git.
    pointer_v1 = repo_dir / "data.csv.dvc"
    pointer_v1.write_text("md5: abc123\npath: data.csv\n")
    repo.git.add(["data.csv.dvc"])
    repo.git.commit(["-m", "Track data.csv with DVC v1"])
    ref_v1 = repo.head.commit.hexsha

    pointer_v1.write_text("md5: def456\npath: data.csv\n")
    repo.git.add(["data.csv.dvc"])
    repo.git.commit(["-m", "Update data.csv v2"])

    history = app.git.get_file_history(repo, path="data.csv", storage="dvc")
    hashes = [c["hash"] for c in history]
    assert ref_v1 in hashes
    assert len(history) == 2
    # Newest first
    assert history[0]["committed_date"] >= history[-1]["committed_date"]


def test_get_file_history_dvc_lock(tmp_path, monkeypatch):
    """get_file_history detects md5 transitions in dvc.lock."""
    monkeypatch.setattr(
        app.projects, "expand_dvc_lock_outs", lambda *a, **k: {}
    )
    repo_dir = tmp_path / "repo"
    repo = git.Repo.init(repo_dir)
    repo.git.config(["user.name", "CI Test"])
    repo.git.config(["user.email", "ci-test@example.com"])

    dvc_lock = repo_dir / "dvc.lock"

    # Commit 1: output appears for the first time.
    dvc_lock.write_text(
        "schema: '2.0'\nstages:\n  train:\n    outs:\n    - path: model.pkl\n      md5: aaa111\n"
    )
    repo.git.add(["dvc.lock"])
    repo.git.commit(["-m", "Add model.pkl in dvc.lock"])
    ref_v1 = repo.head.commit.hexsha

    # Commit 2: unrelated change — md5 unchanged, should NOT appear.
    dvc_lock.write_text(
        "schema: '2.0'\nstages:\n  train:\n    outs:\n    - path: model.pkl\n      md5: aaa111\n  other:\n    outs: []\n"
    )
    repo.git.add(["dvc.lock"])
    repo.git.commit(["-m", "Add unrelated stage"])

    # Commit 3: md5 changed — should appear.
    dvc_lock.write_text(
        "schema: '2.0'\nstages:\n  train:\n    outs:\n    - path: model.pkl\n      md5: bbb222\n"
    )
    repo.git.add(["dvc.lock"])
    repo.git.commit(["-m", "Retrain model"])
    ref_v3 = repo.head.commit.hexsha

    history = app.git.get_file_history(repo, path="model.pkl", storage="dvc")
    hashes = [c["hash"] for c in history]
    assert ref_v1 in hashes, "First appearance commit must be in history"
    assert ref_v3 in hashes, "Updated md5 commit must be in history"
    # The unrelated commit should not be included.
    assert len(history) == 2
    # Newest first
    assert history[0]["committed_date"] >= history[-1]["committed_date"]
