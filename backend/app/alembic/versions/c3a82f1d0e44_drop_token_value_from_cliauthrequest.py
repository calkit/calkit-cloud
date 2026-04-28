"""Rename cliauthrequest to deviceauth and drop token_value

Revision ID: c3a82f1d0e44
Revises: 1fb6e38eb0e9
Create Date: 2026-04-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'c3a82f1d0e44'
down_revision = '1fb6e38eb0e9'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()
    if 'cliauthrequest' in existing_tables:
        op.drop_index('ix_cliauthrequest_device_code', table_name='cliauthrequest')
        op.rename_table('cliauthrequest', 'deviceauth')
        op.create_index(op.f('ix_deviceauth_device_code'), 'deviceauth', ['device_code'], unique=True)
    if 'token_value' in [c['name'] for c in inspector.get_columns('deviceauth')]:
        op.drop_column('deviceauth', 'token_value')


def downgrade():
    op.add_column(
        'deviceauth',
        sa.Column(
            'token_value',
            sqlmodel.sql.sqltypes.AutoString(length=128),
            nullable=True,
        ),
    )
    op.drop_index('ix_deviceauth_device_code', table_name='deviceauth')
    op.rename_table('deviceauth', 'cliauthrequest')
    op.create_index('ix_cliauthrequest_device_code', 'cliauthrequest', ['device_code'], unique=True)
