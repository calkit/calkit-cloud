"""Add CLIAuthRequest table

Revision ID: a1b2c3d4e5f6
Revises: af024967630d
Create Date: 2026-04-27 20:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "af024967630d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cliauthrequest",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "device_code",
            sqlmodel.sql.sqltypes.AutoString(length=64),
            nullable=False,
        ),
        sa.Column(
            "created",
            sa.DateTime(),
            server_default=sa.func.current_timestamp(),
            nullable=False,
        ),
        sa.Column("expires", sa.DateTime(), nullable=False),
        sa.Column(
            "hostname",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=True,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column(
            "token_value",
            sqlmodel.sql.sqltypes.AutoString(length=128),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cliauthrequest_device_code"),
        "cliauthrequest",
        ["device_code"],
        unique=True,
    )


def downgrade():
    op.drop_index(
        op.f("ix_cliauthrequest_device_code"), table_name="cliauthrequest"
    )
    op.drop_table("cliauthrequest")
