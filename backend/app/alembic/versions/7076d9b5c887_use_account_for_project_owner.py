"""Use account for project owner

Revision ID: 7076d9b5c887
Revises: e7671197c00b
Create Date: 2024-09-09 19:23:46.423754

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "7076d9b5c887"
down_revision = "e7671197c00b"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "account", "github_name", existing_type=sa.VARCHAR(), nullable=False
    )
    op.add_column(
        "project", sa.Column("owner_account_id", sa.Uuid(), nullable=False)
    )
    op.drop_constraint(
        "project_owner_user_id_fkey", "project", type_="foreignkey"
    )
    op.create_foreign_key(
        None, "project", "account", ["owner_account_id"], ["id"]
    )
    op.drop_column("project", "owner_user_id")
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "project",
        sa.Column(
            "owner_user_id", sa.UUID(), autoincrement=False, nullable=False
        ),
    )
    op.drop_constraint(None, "project", type_="foreignkey")
    op.create_foreign_key(
        "project_owner_user_id_fkey",
        "project",
        "user",
        ["owner_user_id"],
        ["id"],
    )
    op.drop_column("project", "owner_account_id")
    op.alter_column(
        "account", "github_name", existing_type=sa.VARCHAR(), nullable=True
    )
    # ### end Alembic commands ###