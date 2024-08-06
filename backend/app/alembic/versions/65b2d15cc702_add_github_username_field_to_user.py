"""Add GitHub username field to User

Revision ID: 65b2d15cc702
Revises: 1a31ce608336
Create Date: 2024-08-04 13:24:55.592499

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '65b2d15cc702'
down_revision = '1a31ce608336'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('user', sa.Column('github_username', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('user', 'github_username')
    # ### end Alembic commands ###