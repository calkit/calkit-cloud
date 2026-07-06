"""Merge releases and membership heads

Two migration heads diverged from ``dcef842dee10`` when the releases feature
(from main) and the project-membership / nullable-github_name work (this branch)
landed in parallel:

    dcef842dee10 ->  f3a9c1b7e240                                   (releases)
    dcef842dee10 ->  f3a9c1d2b4e6 -> b7e2f4a1c9d8                   (membership)

This empty merge unifies them into a single head so ``alembic upgrade head`` is
unambiguous. It also repairs databases already stamped at ``b7e2f4a1c9d8`` (they
predate the releases feature): reaching this merge requires ``f3a9c1b7e240``, so
the upgrade applies the releases migration they had not yet seen — no reset
needed.

Revision ID: f1e2d3c4b5a6
Revises: f3a9c1b7e240, b7e2f4a1c9d8
Create Date: 2026-07-06 00:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "f1e2d3c4b5a6"
down_revision = ("f3a9c1b7e240", "b7e2f4a1c9d8")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
