"""Tests for the ``dvc`` module."""

import os
from copy import deepcopy

from app.dvc import make_mermaid_diagram, output_from_pipeline


def test_make_mermaid_diagram():
    pipeline = {
        "stages": {
            "do-something": {
                "cmd": "echo sup",
                "deps": ["somefile.py"],
                "outs": ["something.png"],
            },
            "do-something-else": {
                "cmd": "echo sup2",
                "deps": ["something.png"],
                "outs": ["else.pdf"],
            },
        }
    }
    mm = make_mermaid_diagram(pipeline)
    return mm


def test_output_from_pipeline():
    print(os.getcwd())
    pipeline = {
        "stages": {
            "my_stage": {"deps": []},
            "subdir_stage": {
                "wdir": "backend/scripts",
            },
        }
    }
    lock = deepcopy(pipeline)
    lock["stages"]["my_stage"]["outs"] = [
        {
            "path": "README.md",
            "hash": "md5",
            "md5": "0ac9de94eb7bc991d60df6d4d8a7553d",
            "size": 2828,
        }
    ]
    lock["stages"]["subdir_stage"]["outs"] = [
        {
            "path": "create-initial-data.py",
            "hash": "md5",
            "md5": "0ac9de94eb7bc991d60df6d4d8a7553c",
            "size": 282843,
        }
    ]
    out = output_from_pipeline(
        "README.md", "my_stage", pipeline=pipeline, lock=lock
    )
    assert out["path"] == "README.md"
    out = output_from_pipeline(
        "backend/scripts/create-initial-data.py",
        "subdir_stage",
        pipeline=pipeline,
        lock=lock,
    )
    assert out["path"] == "backend/scripts/create-initial-data.py"
    assert out["md5"].endswith("3c")
    out = output_from_pipeline(
        "something-that-wont/exist",
        "subdir_stage",
        pipeline=pipeline,
        lock=lock,
    )
    assert out is not None
    # Now check that out will be None if we have multiple outs
    lock["stages"]["subdir_stage"]["outs"].append(
        {
            "path": "create-initial-data-2.py",
            "hash": "md5",
            "md5": "0ac9de94eb7bc991d60df6d4d8a7553c",
            "size": 282843,
        }
    )
    out = output_from_pipeline(
        "something-that-wont/exist",
        "subdir_stage",
        pipeline=pipeline,
        lock=lock,
    )
    assert out is None


def test_expand_dvc_lock_outs():
    """This requires the `petebachant/snakemake-tutorial` project to be
    populated in the dev environment.
    """
    pass  # TODO
