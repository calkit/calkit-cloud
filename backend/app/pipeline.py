"""Pipeline staleness detection.

Determines whether each stage in a project's DVC pipeline is up-to-date,
stale, not-run, or unknown, by diffing the committed ``dvc.yaml`` and
``dvc.lock`` against the repo tree and object storage. The pipeline's
object storage (Calkit remote) is treated as authoritative for
DVC-tracked outputs since the API clones never ``dvc fetch``.

Designed to be self-contained and easily swapped for a richer
implementation later (e.g., one that can validate environments or detect
when ``dvc.yaml`` needs recompiling from ``calkit.yaml``).
"""

from __future__ import annotations

import hashlib
import io
import logging
import re
from typing import Literal

import ruamel.yaml
from pydantic import BaseModel, Field

from app.dvc import get_data_fpath_for_md5
from app.git import RepoTree

logger = logging.getLogger(__name__)

_yaml = ruamel.yaml.YAML(typ="safe")

StatusLiteral = Literal["up-to-date", "stale", "not-run", "unknown"]
OverallStatusLiteral = Literal["up-to-date", "stale", "unknown"]


class StageStatus(BaseModel):
    """Status for a single pipeline stage."""

    status: StatusLiteral
    modified_command: bool = False
    modified_inputs: list[str] = Field(default_factory=list)
    modified_outputs: list[str] = Field(default_factory=list)
    missing_outputs: list[str] = Field(default_factory=list)


def _base_stage_name(name: str) -> str:
    return name.split("@")[0]


def _is_dir_md5(md5: str | None) -> bool:
    return bool(md5) and md5.endswith(".dir")


def _safe_yaml_load(data: bytes) -> dict | None:
    try:
        return _yaml.load(io.BytesIO(data))
    except Exception as e:
        logger.warning(f"Failed to parse YAML: {e}")
        return None


def _read_dvc_pointer_md5(tree: RepoTree, path: str) -> str | None:
    """Return the md5 stored in ``<path>.dvc`` if present."""
    dvc_path = path + ".dvc"
    if not tree.is_file(dvc_path):
        return None
    data = _safe_yaml_load(tree.read_bytes(dvc_path))
    if not data:
        return None
    outs = data.get("outs") or []
    if not outs:
        return None
    return outs[0].get("md5")


def _tree_file_md5(tree: RepoTree, path: str) -> str | None:
    if not tree.is_file(path):
        return None
    try:
        return hashlib.md5(tree.read_bytes(path)).hexdigest()
    except Exception as e:
        logger.warning(f"Failed to hash {path}: {e}")
        return None


def _md5_in_object_storage(
    md5: str | None, owner_name: str, project_name: str, fs
) -> bool:
    if not md5:
        return False
    try:
        return (
            get_data_fpath_for_md5(
                owner_name=owner_name,
                project_name=project_name,
                md5=md5,
                fs=fs,
            )
            is not None
        )
    except Exception as e:
        logger.warning(f"Object storage existence check failed for {md5}: {e}")
        return False


def _build_outs_index(dvc_lock: dict) -> dict[str, str | None]:
    """Map out path -> md5 across all stages in the lock."""
    out_map: dict[str, str | None] = {}
    for stage in (dvc_lock.get("stages") or {}).values():
        for out in stage.get("outs") or []:
            p = out.get("path")
            if p:
                out_map[p] = out.get("md5")
    return out_map


def _resolve_current_dep_md5(
    path: str,
    tree: RepoTree,
    outs_index: dict[str, str | None],
) -> str | None:
    """Current md5 for a dep path, or None if missing from the tree."""
    if path in outs_index:
        return outs_index[path]
    ptr = _read_dvc_pointer_md5(tree, path)
    if ptr is not None:
        return ptr
    if tree.is_file(path):
        return _tree_file_md5(tree, path)
    return None


def _get_nested(data: dict | None, dotted_key: str):
    cur = data
    for part in dotted_key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def _normalize_cmd(cmd) -> str | None:
    if cmd is None:
        return None
    if isinstance(cmd, list):
        return " && ".join(str(c) for c in cmd).strip()
    return str(cmd).strip()


def compute_stage_statuses(
    dvc_yaml: dict,
    dvc_lock: dict,
    tree: RepoTree,
    owner_name: str,
    project_name: str,
    fs,
) -> dict[str, StageStatus]:
    """Compute per-stage status for a pipeline.

    Keys are stage names as they appear in ``dvc.lock`` (including
    ``@``-expansions for matrix/foreach stages). Stages declared in
    ``dvc.yaml`` but never run are reported with status ``not-run`` under
    their base name.
    """
    lock_stages = dvc_lock.get("stages") or {}
    yaml_stages = dvc_yaml.get("stages") or {}
    outs_index = _build_outs_index(dvc_lock)
    result: dict[str, StageStatus] = {}
    locked_bases = {_base_stage_name(n) for n in lock_stages.keys()}
    for stage_name in yaml_stages.keys():
        if stage_name.startswith("_"):
            continue
        if stage_name not in locked_bases:
            result[stage_name] = StageStatus(status="not-run")
    for stage_name, lock_stage in lock_stages.items():
        base = _base_stage_name(stage_name)
        if base.startswith("_"):
            continue
        yaml_stage = yaml_stages.get(base) or {}
        modified_command = False
        modified_inputs: list[str] = []
        modified_outputs: list[str] = []
        missing_outputs: list[str] = []
        yaml_cmd = _normalize_cmd(
            yaml_stage.get("cmd") if isinstance(yaml_stage, dict) else None
        )
        lock_cmd = _normalize_cmd(lock_stage.get("cmd"))
        if (
            yaml_cmd is not None
            and lock_cmd is not None
            and "${" not in yaml_cmd
            and yaml_cmd != lock_cmd
        ):
            modified_command = True
        for dep in lock_stage.get("deps") or []:
            dep_path = dep.get("path")
            lock_md5 = dep.get("md5") or dep.get("hash")
            if not dep_path:
                continue
            if _is_dir_md5(lock_md5):
                if _md5_in_object_storage(
                    lock_md5, owner_name, project_name, fs
                ):
                    continue
                if not tree.exists(dep_path):
                    modified_inputs.append(dep_path)
                continue
            current = _resolve_current_dep_md5(dep_path, tree, outs_index)
            if current is None:
                if _md5_in_object_storage(
                    lock_md5, owner_name, project_name, fs
                ):
                    continue
                modified_inputs.append(dep_path)
            elif lock_md5 is not None and current != lock_md5:
                modified_inputs.append(dep_path)
        for params_file, locked_params in (
            lock_stage.get("params") or {}
        ).items():
            if not isinstance(locked_params, dict):
                continue
            if not tree.is_file(params_file):
                for key in locked_params:
                    modified_inputs.append(f"{params_file}:{key}")
                continue
            current_params = (
                _safe_yaml_load(tree.read_bytes(params_file)) or {}
            )
            for key, locked_val in locked_params.items():
                if _get_nested(current_params, key) != locked_val:
                    modified_inputs.append(f"{params_file}:{key}")
        for out in lock_stage.get("outs") or []:
            out_path = out.get("path")
            lock_md5 = out.get("md5") or out.get("hash")
            if not out_path:
                continue
            if _is_dir_md5(lock_md5):
                if _md5_in_object_storage(
                    lock_md5, owner_name, project_name, fs
                ):
                    continue
                if not tree.exists(out_path):
                    missing_outputs.append(out_path)
                continue
            available_md5: str | None = None
            if tree.is_file(out_path):
                available_md5 = _tree_file_md5(tree, out_path)
            else:
                ptr = _read_dvc_pointer_md5(tree, out_path)
                if ptr is not None:
                    available_md5 = ptr
            if available_md5 is None:
                if _md5_in_object_storage(
                    lock_md5, owner_name, project_name, fs
                ):
                    continue
                missing_outputs.append(out_path)
            elif lock_md5 is not None and available_md5 != lock_md5:
                modified_outputs.append(out_path)
        is_stale = bool(
            modified_command
            or modified_inputs
            or modified_outputs
            or missing_outputs
        )
        result[stage_name] = StageStatus(
            status="stale" if is_stale else "up-to-date",
            modified_command=modified_command,
            modified_inputs=modified_inputs,
            modified_outputs=modified_outputs,
            missing_outputs=missing_outputs,
        )
    return result


def overall_pipeline_status(
    stage_statuses: dict[str, StageStatus],
) -> OverallStatusLiteral:
    if not stage_statuses:
        return "unknown"
    statuses = {s.status for s in stage_statuses.values()}
    if "stale" in statuses or "not-run" in statuses:
        return "stale"
    if statuses == {"up-to-date"}:
        return "up-to-date"
    return "unknown"


_MERMAID_NODE_RE = re.compile(r'^\s*(node\d+)\["([^"]+)"\]\s*$')

_MERMAID_STYLES = {
    "stale": "fill:#fff0b3,stroke:#c18a00,color:#7a5200",
    "not-run": "fill:#e8e8e8,stroke:#888,color:#555",
    "up-to-date": "fill:#d6f5d6,stroke:#3a8a3a,color:#1f5a1f",
}


def color_mermaid_by_status(
    mermaid: str, stage_statuses: dict[str, StageStatus]
) -> str:
    """Append classDef/class lines to a Mermaid diagram that color each
    stage node by its status. Stages with ``unknown`` status are left
    uncolored.
    """
    if not mermaid or not stage_statuses:
        return mermaid
    rank = {"up-to-date": 0, "unknown": 1, "not-run": 2, "stale": 3}
    # Collapse @-expanded matrix stages to their base, worst-status wins
    base_status: dict[str, str] = {}
    for name, info in stage_statuses.items():
        base = name.split("@")[0]
        prev = base_status.get(base)
        if prev is None or rank.get(info.status, 0) > rank.get(prev, 0):
            base_status[base] = info.status
    buckets: dict[str, list[str]] = {
        "stale": [],
        "not-run": [],
        "up-to-date": [],
    }
    for line in mermaid.splitlines():
        m = _MERMAID_NODE_RE.match(line)
        if not m:
            continue
        node_id, label = m.group(1), m.group(2)
        status = base_status.get(label.split("@")[0])
        if status in buckets:
            buckets[status].append(node_id)
    extra: list[str] = []
    for status, nodes in buckets.items():
        if not nodes:
            continue
        extra.append(f"\tclassDef {status} {_MERMAID_STYLES[status]}")
        extra.append(f"\tclass {','.join(nodes)} {status}")
    if not extra:
        return mermaid
    return mermaid.rstrip() + "\n" + "\n".join(extra) + "\n"


def find_stage_for_path(path: str, dvc_lock: dict) -> str | None:
    """Return the first stage in ``dvc.lock`` whose outs include *path*."""
    for stage_name, stage in (dvc_lock.get("stages") or {}).items():
        for out in stage.get("outs") or []:
            if out.get("path") == path:
                return stage_name
    return None
