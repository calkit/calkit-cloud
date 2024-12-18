"""Drop items

Revision ID: ab7816be480b
Revises: 208e7457f3ba
Create Date: 2024-09-10 12:21:17.125740

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'ab7816be480b'
down_revision = '208e7457f3ba'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('item')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('item',
    sa.Column('description', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    sa.Column('title', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('owner_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['user.id'], name='item_owner_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='item_pkey')
    )
    # ### end Alembic commands ###
