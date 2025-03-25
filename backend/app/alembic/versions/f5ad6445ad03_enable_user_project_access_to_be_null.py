"""Enable user project access to be null

Revision ID: f5ad6445ad03
Revises: d3a8021fb433
Create Date: 2025-02-19 20:58:19.990432

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'f5ad6445ad03'
down_revision = 'd3a8021fb433'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('userprojectaccess', 'access',
               existing_type=sa.VARCHAR(length=32),
               nullable=True)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('userprojectaccess', 'access',
               existing_type=sa.VARCHAR(length=32),
               nullable=False)
    # ### end Alembic commands ###
