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
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

import ruamel.yaml
from pydantic import BaseModel, Field

from app.dvc import get_data_fpath_for_md5
from app.git import RepoTree

logger = logging.getLogger(__name__)

_yaml = ruamel.yaml.YAML(typ="safe")

StatusLiteral = Literal[
    "up-to-date", "stale", "not-run", "unknown", "always-run", "frozen"
]
OverallStatusLiteral = Literal["up-to-date", "stale", "unknown"]

# Object-storage existence checks are the dominant cost in
# compute_stage_statuses (one+ network round-trip per dep/out md5). We both
# parallelize them within a computation and cache the whole result keyed by a
# content token (the tree/commit SHA) so repeat reads of the same ref are free.
_STORAGE_CHECK_MAX_WORKERS = 16
_STAGE_STATUS_CACHE_MAX = 64
# TTL bounds the one non-deterministic dimension: objects uploaded after a
# cache entry was written (the SHA pins everything in the tree itself).
_STAGE_STATUS_CACHE_TTL_S = 600
_stage_status_cache: "OrderedDict[str, tuple[float, dict[str, StageStatus]]]" = OrderedDict()
# Sync endpoints run in a threadpool, so cache reads/evictions/writes can happen
# concurrently. Guard every mutation with this lock to keep the OrderedDict and
# its LRU order consistent.
_stage_status_cache_lock = threading.Lock()


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


def _precompute_storage_presence(
    dvc_lock: dict, owner_name: str, project_name: str, fs
) -> dict[str, bool]:
    """Existence in object storage for every dep/out md5, checked in parallel.

    Replaces the serial per-md5 ``fs.exists`` round-trips with one concurrent
    batch. Returns a ``{md5: present}`` map; md5s absent from the map are
    treated as not present by callers.
    """
    md5s: set[str] = set()
    for stage in (dvc_lock.get("stages") or {}).values():
        for entry in (stage.get("deps") or []) + (stage.get("outs") or []):
            m = entry.get("md5") or entry.get("hash")
            if m:
                md5s.add(m)
    if not md5s:
        return {}
    presence: dict[str, bool] = {}
    workers = min(_STORAGE_CHECK_MAX_WORKERS, len(md5s))
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = ex.map(
            lambda m: (
                m,
                _md5_in_object_storage(m, owner_name, project_name, fs),
            ),
            md5s,
        )
        for m, present in results:
            presence[m] = present
    return presence


def _stage_status_cache_key(
    owner_name: str, project_name: str, cache_token: str | None
) -> str | None:
    if not cache_token:
        return None
    h = hashlib.sha1()
    h.update(owner_name.encode())
    h.update(b"\0")
    h.update(project_name.encode())
    h.update(b"\0")
    h.update(cache_token.encode())
    return h.hexdigest()


def _stage_status_cache_get(cache_key: str) -> dict[str, StageStatus] | None:
    with _stage_status_cache_lock:
        cached = _stage_status_cache.get(cache_key)
        if cached is None:
            return None
        cached_at, value = cached
        if time.monotonic() - cached_at > _STAGE_STATUS_CACHE_TTL_S:
            del _stage_status_cache[cache_key]
            return None
        _stage_status_cache.move_to_end(cache_key)
        return value


def _stage_status_cache_put(
    cache_key: str, value: dict[str, StageStatus]
) -> None:
    with _stage_status_cache_lock:
        _stage_status_cache[cache_key] = (time.monotonic(), value)
        _stage_status_cache.move_to_end(cache_key)
        if len(_stage_status_cache) > _STAGE_STATUS_CACHE_MAX:
            _stage_status_cache.popitem(last=False)


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
    cache_token: str | None = None,
) -> dict[str, StageStatus]:
    """Compute per-stage status for a pipeline.

    Keys are stage names as they appear in ``dvc.lock`` (including
    ``@``-expansions for matrix/foreach stages). Stages declared in
    ``dvc.yaml`` but never run are reported with status ``not-run`` under
    their base name.

    When ``cache_token`` is given (a content-identifying token such as the
    tree/commit SHA the inputs were read from), the result is cached so repeat
    calls for the same ref skip the object-storage round-trips entirely. The
    token must change whenever any tracked file does -- a commit/tree SHA does,
    the ``dvc.lock`` bytes alone do NOT (a dep can change while the lock stays
    the same, which is exactly what staleness detects).
    """
    cache_key = _stage_status_cache_key(owner_name, project_name, cache_token)
    if cache_key is not None:
        hit = _stage_status_cache_get(cache_key)
        if hit is not None:
            return hit
    lock_stages = dvc_lock.get("stages") or {}
    yaml_stages = dvc_yaml.get("stages") or {}
    outs_index = _build_outs_index(dvc_lock)
    presence = _precompute_storage_presence(
        dvc_lock, owner_name, project_name, fs
    )
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
                # Directory dep: trust object storage, otherwise assume current
                # if present in the tree. If we can observe neither, we can't
                # prove it changed -- don't flag stale (same rationale as the
                # unobservable file-dep case below).
                continue
            current = _resolve_current_dep_md5(dep_path, tree, outs_index)
            if current is None:
                # The cloud can't observe this dep: it's not in the git tree,
                # has no .dvc pointer, isn't another stage's out, and isn't in
                # object storage. This is normal for gitignored calkit
                # intermediates (e.g. cleaned notebooks, which calkit cleans
                # on the fly and never commits). We can't compute a current
                # hash, so we have no evidence it changed -- don't flag stale.
                continue
            if lock_md5 is not None and current != lock_md5:
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
                if presence.get(lock_md5, False):
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
                if presence.get(lock_md5, False):
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
        # A stage compiled with ``always_changed: true`` (calkit's
        # ``always_run``) re-executes every time by design. When that's its
        # only "change", it isn't really stale -- surface it distinctly.
        always_changed = bool(
            isinstance(yaml_stage, dict) and yaml_stage.get("always_changed")
        )
        # A frozen stage (``dvc freeze``) is pinned: DVC won't re-run it even
        # when its deps change, so it's never stale -- surface it as frozen.
        frozen = bool(
            isinstance(yaml_stage, dict) and yaml_stage.get("frozen")
        )
        if frozen:
            status: StatusLiteral = "frozen"
        elif is_stale:
            status = "stale"
        elif always_changed:
            status = "always-run"
        else:
            status = "up-to-date"
        result[stage_name] = StageStatus(
            status=status,
            modified_command=modified_command,
            modified_inputs=modified_inputs,
            modified_outputs=modified_outputs,
            missing_outputs=missing_outputs,
        )
    if cache_key is not None:
        _stage_status_cache_put(cache_key, result)
    return result


def overall_pipeline_status(
    stage_statuses: dict[str, StageStatus],
) -> OverallStatusLiteral:
    if not stage_statuses:
        return "unknown"
    statuses = {s.status for s in stage_statuses.values()}
    if "stale" in statuses or "not-run" in statuses:
        return "stale"
    # Always-run stages re-execute by design and frozen stages are pinned;
    # neither makes a pipeline stale.
    if statuses <= {"up-to-date", "always-run", "frozen"}:
        return "up-to-date"
    return "unknown"


_MERMAID_NODE_RE = re.compile(r'^\s*(node\d+)\["([^"]+)"\]\s*$')

_MERMAID_STYLES = {
    "stale": "fill:#8a6a00,stroke:#c9a227,color:#fff5cc",
    "not-run": "fill:#3a3a3a,stroke:#888,color:#ddd",
    "up-to-date": "fill:#1f5a1f,stroke:#3a8a3a,color:#d6f5d6",
    "always-run": "fill:#1a4f7a,stroke:#3a8fd6,color:#d6ecff",
    # Frozen stages are pinned, not stale -- a frosty gray-blue (ice).
    "frozen": "fill:#5e7d8a,stroke:#a9d7e8,color:#eaf7fc",
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
    rank = {
        "up-to-date": 0,
        "frozen": 1,
        "always-run": 1,
        "unknown": 2,
        "not-run": 3,
        "stale": 4,
    }
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
        "always-run": [],
        "frozen": [],
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
    """Return the stage in ``dvc.lock`` that produces *path*.

    Matches an exact out path first; failing that, matches a stage whose out is
    a *directory* containing *path* (e.g. an out of ``figures`` produces
    ``figures/test.png``). Exact matches always win over directory matches.
    """
    dir_match: str | None = None
    for stage_name, stage in (dvc_lock.get("stages") or {}).items():
        for out in stage.get("outs") or []:
            out_path = out.get("path")
            if not out_path:
                continue
            if out_path == path:
                return stage_name
            if dir_match is None and path.startswith(
                out_path.rstrip("/") + "/"
            ):
                dir_match = stage_name
    return dir_match
