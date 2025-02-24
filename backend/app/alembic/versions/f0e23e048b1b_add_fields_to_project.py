"""Add fields to project

Revision ID: f0e23e048b1b
Revises: c749b39072d3
Create Date: 2024-08-29 12:51:48.311476

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.sql import func


# revision identifiers, used by Alembic.
revision = 'f0e23e048b1b'
down_revision = 'c749b39072d3'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('project', sa.Column('created', sa.DateTime(), nullable=True, server_default=func.now()))
    op.add_column('project', sa.Column('updated', sa.DateTime(), nullable=True, server_onupdate=func.now()))
    op.add_column('project', sa.Column('latest_git_rev', sqlmodel.sql.sqltypes.AutoString(length=40), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('project', 'latest_git_rev')
    op.drop_column('project', 'updated')
    op.drop_column('project', 'created')
    # ### end Alembic commands ###
