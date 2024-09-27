"""Functionality for working with DVC."""

import os
import tempfile

import ruamel.yaml
from dvc.commands import dag
from dvc.repo import Repo

yaml = ruamel.yaml.YAML()


def make_mermaid_diagram(pipeline: dict) -> str:
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
    """
    stage = pipeline.get("stages", {}).get(stage_name)
    if stage is None:
        return
    wdir = stage.get("wdir", "")
    outs = lock.get("stages", []).get(stage_name, {}).get("outs", [])
    # If there's only one output, no need to check path
    if len(outs) == 1:
        out = outs[0]
        out["path"] = path
        return out
    for out in outs:
        outpath = os.path.join(wdir, out["path"])
        if os.path.abspath(outpath) == os.path.abspath(path):
            out["path"] = path
            return out
