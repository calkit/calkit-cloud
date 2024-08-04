"""Make project description nullable

Revision ID: 1546aa334cd5
Revises: 5ba89308431f
Create Date: 2024-08-04 15:07:45.731163

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '1546aa334cd5'
down_revision = '5ba89308431f'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('project', 'description',
               existing_type=sa.VARCHAR(length=2048),
               nullable=True)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('project', 'description',
               existing_type=sa.VARCHAR(length=2048),
               nullable=False)
    # ### end Alembic commands ###
