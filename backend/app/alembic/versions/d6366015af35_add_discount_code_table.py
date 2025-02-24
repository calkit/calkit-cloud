"""Add discount code table

Revision ID: d6366015af35
Revises: edcabfca98df
Create Date: 2024-09-12 14:21:51.375937

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'd6366015af35'
down_revision = 'edcabfca98df'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('discountcode',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('created_by_user_id', sa.Uuid(), nullable=False),
    sa.Column('created_for_account_id', sa.Uuid(), nullable=True),
    sa.Column('valid_from', sa.DateTime(), nullable=True),
    sa.Column('valid_until', sa.DateTime(), nullable=True),
    sa.Column('subscription_type_id', sa.Integer(), nullable=False),
    sa.Column('price', sa.Float(), nullable=False),
    sa.Column('months', sa.Integer(), nullable=False),
    sa.Column('n_users', sa.Integer(), nullable=False),
    sa.Column('redeemed', sa.DateTime(), nullable=True),
    sa.Column('redeemed_by_user_id', sa.Uuid(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_user_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['created_for_account_id'], ['account.id'], ),
    sa.ForeignKeyConstraint(['redeemed_by_user_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('discountcode')
    # ### end Alembic commands ###
