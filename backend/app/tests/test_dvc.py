"""Tests for the ``dvc`` module."""

from app.dvc import make_mermaid_diagram


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
