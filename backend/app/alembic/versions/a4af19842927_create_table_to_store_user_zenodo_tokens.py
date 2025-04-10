"""Create table to store user Zenodo tokens

Revision ID: a4af19842927
Revises: f74a96172dbd
Create Date: 2024-09-24 14:04:02.465606

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "a4af19842927"
down_revision = "f74a96172dbd"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "userzenodotoken",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "updated",
            sa.DateTime(),
            server_default=sa.func.now(),
            server_onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "access_token", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column(
            "refresh_token", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column("expires", sa.DateTime(), nullable=True),
        sa.Column("refresh_token_expires", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
        ),
        sa.PrimaryKeyConstraint("user_id"),
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("userzenodotoken")
    # ### end Alembic commands ###
