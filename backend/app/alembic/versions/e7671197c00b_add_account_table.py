"""Add account table

Revision ID: e7671197c00b
Revises: d01ce914143d
Create Date: 2024-09-09 18:54:29.237754

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "e7671197c00b"
down_revision = "d01ce914143d"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "org",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "display_name",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "account",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "name", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False
        ),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("org_id", sa.Uuid(), nullable=True),
        sa.Column(
            "github_name", sqlmodel.sql.sqltypes.AutoString(), nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["org_id"],
            ["org.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.drop_column("user", "github_username")
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "user",
        sa.Column(
            "github_username", sa.VARCHAR(), autoincrement=False, nullable=True
        ),
    )
    op.drop_table("account")
    op.drop_table("org")
    # ### end Alembic commands ###
