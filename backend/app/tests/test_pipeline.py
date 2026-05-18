"""Tests for app.pipeline (pipeline staleness detection)."""

import hashlib

import git

from app.git import get_repo_tree_for_ref
from app.pipeline import (
    compute_stage_statuses,
    find_stage_for_path,
    overall_pipeline_status,
)


class FakeFS:
    """Minimal fsspec-like FS recording which md5s exist in object storage."""

    def __init__(self, existing_md5s: set[str] | None = None) -> None:
        self._existing = existing_md5s or set()

    def exists(self, path: str) -> bool:
        return any(
            md5[:2] in path and md5[2:] in path for md5 in self._existing
        )


def _init_repo(repo_dir) -> git.Repo:
    repo = git.Repo.init(repo_dir)
    repo.git.config(["user.name", "CI Test"])
    repo.git.config(["user.email", "ci-test@example.com"])
    return repo


def _commit(repo: git.Repo, files: dict[str, str], msg: str) -> None:
    root = repo.working_dir
    paths = []
    for rel, content in files.items():
        full = f"{root}/{rel}"
        import os

        os.makedirs(os.path.dirname(full) or root, exist_ok=True)
        with open(full, "w") as f:
            f.write(content)
        paths.append(rel)
    repo.git.add(paths)
    repo.git.commit(["-m", msg])


def _md5(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()


def test_up_to_date_stage(tmp_path):
    repo = _init_repo(tmp_path / "repo")
    script = "print('hi')\n"
    _commit(
        repo,
        {"script.py": script, "out.txt": "result\n"},
        "init",
    )
    tree = get_repo_tree_for_ref(repo, None)
    dvc_yaml = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": ["script.py"],
                "outs": ["out.txt"],
            }
        }
    }
    dvc_lock = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": [{"path": "script.py", "md5": _md5(script)}],
                "outs": [{"path": "out.txt", "md5": _md5("result\n")}],
            }
        }
    }
    statuses = compute_stage_statuses(
        dvc_yaml, dvc_lock, tree, "o", "p", FakeFS()
    )
    assert statuses["run"].status == "up-to-date"
    assert overall_pipeline_status(statuses) == "up-to-date"


def test_modified_command(tmp_path):
    repo = _init_repo(tmp_path / "repo")
    script = "print('hi')\n"
    _commit(
        repo,
        {"script.py": script, "out.txt": "result\n"},
        "init",
    )
    tree = get_repo_tree_for_ref(repo, None)
    dvc_yaml = {
        "stages": {
            "run": {
                "cmd": "python script.py --new",
                "deps": ["script.py"],
                "outs": ["out.txt"],
            }
        }
    }
    dvc_lock = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": [{"path": "script.py", "md5": _md5(script)}],
                "outs": [{"path": "out.txt", "md5": _md5("result\n")}],
            }
        }
    }
    statuses = compute_stage_statuses(
        dvc_yaml, dvc_lock, tree, "o", "p", FakeFS()
    )
    assert statuses["run"].status == "stale"
    assert statuses["run"].modified_command is True


def test_modified_input(tmp_path):
    repo = _init_repo(tmp_path / "repo")
    _commit(
        repo,
        {"script.py": "print('new')\n", "out.txt": "result\n"},
        "init",
    )
    tree = get_repo_tree_for_ref(repo, None)
    dvc_yaml = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": ["script.py"],
                "outs": ["out.txt"],
            }
        }
    }
    dvc_lock = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": [{"path": "script.py", "md5": _md5("print('old')\n")}],
                "outs": [{"path": "out.txt", "md5": _md5("result\n")}],
            }
        }
    }
    statuses = compute_stage_statuses(
        dvc_yaml, dvc_lock, tree, "o", "p", FakeFS()
    )
    assert statuses["run"].status == "stale"
    assert "script.py" in statuses["run"].modified_inputs


def test_missing_output_found_in_object_storage(tmp_path):
    repo = _init_repo(tmp_path / "repo")
    _commit(repo, {"script.py": "x\n"}, "init")
    tree = get_repo_tree_for_ref(repo, None)
    out_md5 = _md5("result\n")
    dvc_yaml = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": ["script.py"],
                "outs": ["data/out.bin"],
            }
        }
    }
    dvc_lock = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": [{"path": "script.py", "md5": _md5("x\n")}],
                "outs": [{"path": "data/out.bin", "md5": out_md5}],
            }
        }
    }
    fs = FakeFS(existing_md5s={out_md5})
    statuses = compute_stage_statuses(dvc_yaml, dvc_lock, tree, "o", "p", fs)
    assert statuses["run"].status == "up-to-date"


def test_missing_output_not_in_object_storage(tmp_path):
    repo = _init_repo(tmp_path / "repo")
    _commit(repo, {"script.py": "x\n"}, "init")
    tree = get_repo_tree_for_ref(repo, None)
    dvc_yaml = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": ["script.py"],
                "outs": ["data/out.bin"],
            }
        }
    }
    dvc_lock = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": [{"path": "script.py", "md5": _md5("x\n")}],
                "outs": [{"path": "data/out.bin", "md5": _md5("result\n")}],
            }
        }
    }
    statuses = compute_stage_statuses(
        dvc_yaml, dvc_lock, tree, "o", "p", FakeFS()
    )
    assert statuses["run"].status == "stale"
    assert "data/out.bin" in statuses["run"].missing_outputs


def test_not_run_stage(tmp_path):
    repo = _init_repo(tmp_path / "repo")
    _commit(repo, {"script.py": "x\n"}, "init")
    tree = get_repo_tree_for_ref(repo, None)
    dvc_yaml = {
        "stages": {
            "run": {
                "cmd": "python script.py",
                "deps": ["script.py"],
                "outs": ["out.txt"],
            }
        }
    }
    dvc_lock = {"stages": {}}
    statuses = compute_stage_statuses(
        dvc_yaml, dvc_lock, tree, "o", "p", FakeFS()
    )
    assert statuses["run"].status == "not-run"
    assert overall_pipeline_status(statuses) == "stale"


def test_find_stage_for_path():
    dvc_lock = {
        "stages": {
            "plot": {
                "outs": [{"path": "figures/foo.png", "md5": "abc"}],
            },
            "train": {
                "outs": [{"path": "model.pkl", "md5": "def"}],
            },
        }
    }
    assert find_stage_for_path("figures/foo.png", dvc_lock) == "plot"
    assert find_stage_for_path("model.pkl", dvc_lock) == "train"
    assert find_stage_for_path("missing", dvc_lock) is None
