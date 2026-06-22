"""Add project membership and invitations

Native (non-GitHub) project membership plus shareable invite links, so users
without GitHub accounts can be granted collaborator access.

Revision ID: b7e2f4a1c9d8
Revises: f3a9c1d2b4e6
Create Date: 2026-06-17 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "b7e2f4a1c9d8"
down_revision = "f3a9c1d2b4e6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "projectmembership",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("created", sa.DateTime(), nullable=False),
        sa.Column(
            "updated",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("invited_by_user_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["project.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["invited_by_user_id"], ["user.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("user_id", "project_id"),
    )
    op.create_table(
        "projectinvitation",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column(
            "token_hash",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("created", sa.DateTime(), nullable=False),
        sa.Column("expires", sa.DateTime(), nullable=True),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("use_count", sa.Integer(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"], ["project.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["user.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_projectinvitation_token_hash"),
        "projectinvitation",
        ["token_hash"],
        unique=True,
    )


def downgrade():
    op.drop_index(
        op.f("ix_projectinvitation_token_hash"),
        table_name="projectinvitation",
    )
    op.drop_table("projectinvitation")
    op.drop_table("projectmembership")
