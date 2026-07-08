"""Add name and email to project invitation

Lets invite links be labeled (name) and emailed to a specific recipient
(email). Both nullable — existing links have neither.

Revision ID: a3b1c2d4e5f6
Revises: f1e2d3c4b5a6
Create Date: 2026-07-07 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "a3b1c2d4e5f6"
down_revision = "f1e2d3c4b5a6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "projectinvitation",
        sa.Column(
            "name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True
        ),
    )
    op.add_column(
        "projectinvitation",
        sa.Column(
            "email", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True
        ),
    )


def downgrade():
    op.drop_column("projectinvitation", "email")
    op.drop_column("projectinvitation", "name")
