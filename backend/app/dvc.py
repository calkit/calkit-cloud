"""Functionality for working with DVC."""

import glob
import json
import logging
import os
import tempfile

import ruamel.yaml
from dvc.commands import dag
from dvc.repo import Repo

from app.storage import get_object_fs, make_data_fpath

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)
yaml = ruamel.yaml.YAML()


def make_mermaid_diagram(pipeline: dict, params: dict | None = None) -> str:
    """Create a Mermaid diagram from a pipeline file (typically ``dvc.yaml``).

    This is a little hacky since we need to create a Git and DVC repo in order
    to run the commands in DVC.
    """
    wd_orig = os.getcwd()
    try:
        with tempfile.TemporaryDirectory() as tmpdirname:
            os.chdir(tmpdirname)
            with open("dvc.yaml", "w") as f:
                yaml.dump(pipeline, f)
            if params is not None:
                with open("params.yaml", "w") as f:
                    yaml.dump(params, f)
            with Repo.init(
                ".",
                no_scm=True,
                force=False,
                subdir=False,
            ) as repo:
                d = dag._build(repo)
            mm = dag._show_mermaid(d, markdown=False)
    finally:
        os.chdir(wd_orig)
    return mm


def output_from_pipeline(
    path: str, stage_name: str, pipeline: dict, lock: dict
) -> dict | None:
    """Given a path and stage name, search through the DVC pipeline config and
    DVC lock files to see if the path exists as a DVC output.

    What is returned will look like a single DVC output object, e.g.,

        - path: environment.lock.yml
          hash: md5
          md5: cacb2fa264cff6fd46c76da5de7645ac
          size: 9536

    """
    stage = pipeline.get("stages", {}).get(stage_name.split("@")[0])
    if stage is None:
        return
    wdir = stage.get("wdir", "")
    outs = lock.get("stages", {}).get(stage_name, {}).get("outs", [])
    for out in outs:
        outpath = os.path.join(wdir, out["path"])
        if os.path.abspath(outpath) == os.path.abspath(path):
            out["path"] = path
            return out
    # If there's only one output, no need to check path if we don't have an
    # exact match
    if len(outs) == 1:
        return outs[0]


def find_dvc_files(start: str, max_depth=5) -> list[str]:
    """Find all DVC files in the repo."""
    res = []
    for i in range(max_depth):
        pattern = os.path.join(start, *["*"] * (i + 1), "*.dvc")
        res += glob.glob(pattern)
        res += glob.glob(pattern)
    return res


def expand_dvc_lock_outs(
    dvc_lock: dict,
    owner_name: str,
    project_name: str,
    get_sizes: bool = False,
    fs=None,
) -> dict:
    """Expand all outs in a DVC lock file.

    Will only pick up those in cloud storage, i.e., not ones that are
    committed to Git.

    Output dictionary structure will look like:

        {
            "figures/plot.png": {
                "path": "figures/plot.png",
                "hash": "md5",
                "md5": "d4cd33821c032be468a77d65873937bc",
                "size": 43613,
            },
            "data/raw": {
                "path": "data/raw",
                "hash": "md5",
                "md5": "d0b6bbbdd9a3dcd765978cda2c754fe7.dir",
                "size": 55354,
                "nfiles": 2,
                "children": [
                    "data/raw/file1.h5...
                ]
            },
            "data/raw/file1.h5": {
                "path": "data/raw/file1.h5",
                "md5": "c3dddc7bf94809e09559b0ae327037f7",
            },
            "data/raw/file2.h5": {
                "path": "data/raw/file2.h5",
                "md5": "d3dddc7bf94809e09669b0ae327037f7",
            }
        }

    """
    if fs is None:
        fs = get_object_fs()
    stages = dvc_lock.get("stages", {})
    dvc_lock_outs = {}
    dvc_md5_sizes = {}
    for stage_name, stage in stages.items():
        for out in stage.get("outs", []):
            outpath = out["path"]
            md5 = out.get("md5", "")
            # If this is a directory, try to fetch its file from cloud storage
            # so we can read off all of the sub-outs
            if md5 and md5.endswith(".dir"):
                dvc_dir_path = make_data_fpath(
                    owner_name=owner_name,
                    project_name=project_name,
                    idx=md5[:2],
                    md5=md5[2:],
                )
                if fs.exists(dvc_dir_path):
                    with fs.open(dvc_dir_path) as f:
                        dvc_dir_contents = json.load(f)
                    dvc_lock_outs[outpath] = out
                    dvc_lock_outs[outpath]["dirname"] = os.path.dirname(
                        outpath
                    )
                    dvc_lock_outs[outpath]["type"] = "dir"
                    dvc_lock_outs[outpath]["stage"] = stage_name
                    if "children" not in dvc_lock_outs[outpath]:
                        dvc_lock_outs[outpath]["children"] = []
                    # Handle the fact that DVC relpaths could actually be in
                    # subdirectories, so we need to also ensure these subdirs
                    # make it
                    # TODO: This only works one level deep--should be recursive
                    for dvc_obj in dvc_dir_contents:
                        relpath = dvc_obj["relpath"]
                        fname = os.path.basename(relpath)
                        subdir = os.path.dirname(relpath)
                        md5 = dvc_obj.get("md5")
                        if get_sizes and md5 not in dvc_md5_sizes:
                            fpath_i = make_data_fpath(
                                owner_name=owner_name,
                                project_name=project_name,
                                idx=md5[:2],
                                md5=md5[2:],
                            )
                            try:
                                size = fs.size(fpath_i)
                            except Exception as e:
                                logger.warning(
                                    f"Failed to get size for {fpath_i}: {e}"
                                )
                            dvc_md5_sizes[md5] = size
                        if subdir:
                            subdir_full_relpath = os.path.join(outpath, subdir)
                            if subdir_full_relpath not in dvc_lock_outs:
                                dvc_lock_outs[subdir_full_relpath] = dict(
                                    type="dir",
                                    children=[],
                                    dirname=outpath,
                                    stage=stage_name,
                                )
                            dvc_lock_outs[subdir_full_relpath][
                                "children"
                            ].append(
                                dict(
                                    relpath=fname,
                                    md5=md5,
                                    type="file",
                                    dirname=subdir_full_relpath,
                                    stage=stage_name,
                                    size=dvc_md5_sizes.get(md5),
                                )
                            )
                            if (
                                subdir_full_relpath
                                not in dvc_lock_outs[outpath]["children"]
                            ):
                                dvc_lock_outs[outpath]["children"].append(
                                    dict(
                                        relpath=subdir,
                                        type="dir",
                                        stage=stage_name,
                                        dirname=outpath,
                                    )
                                )
                        else:
                            subdir_full_relpath = outpath
                        full_relpath = os.path.join(outpath, relpath)
                        dvc_lock_outs[full_relpath] = dvc_obj | dict(
                            dirname=subdir_full_relpath,
                            type="file",
                            stage=stage_name,
                            relpath=fname,
                            path=full_relpath,
                            size=dvc_md5_sizes.get(md5),
                        )
            else:
                dvc_lock_outs[outpath] = out | dict(
                    dirname=os.path.dirname(outpath),
                    type="file",
                    stage=stage_name,
                )
    return dvc_lock_outs
