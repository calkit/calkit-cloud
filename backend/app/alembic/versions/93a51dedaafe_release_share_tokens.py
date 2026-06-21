"""Release share tokens; internalize releases

Replaces the single per-release secret token with a ``releasesharetoken`` table
(hashed, email-scoped, revocable), drops the now-unused release columns, and
adds comment provenance (share token, author email, git rev).

Revision ID: 93a51dedaafe
Revises: f3a9c1b27d40
Create Date: 2026-06-20

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '93a51dedaafe'
down_revision = 'f3a9c1b27d40'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'releasesharetoken',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('release_id', sa.Uuid(), nullable=False),
        sa.Column('created_by_user_id', sa.Uuid(), nullable=False),
        sa.Column('token_hash', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
        sa.Column('email', sqlmodel.sql.sqltypes.AutoString(length=320), nullable=True),
        sa.Column('permission', sqlmodel.sql.sqltypes.AutoString(length=16), nullable=False),
        sa.Column('note', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('revoked', sa.Boolean(), nullable=False),
        sa.Column('view_count', sa.Integer(), nullable=False),
        sa.Column('created', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['release_id'], ['release.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_releasesharetoken_token_hash'),
        'releasesharetoken',
        ['token_hash'],
        unique=True,
    )
    op.drop_index(op.f('ix_release_secret_token'), table_name='release')
    op.drop_column('release', 'secret_token')
    op.drop_column('release', 'allow_anonymous_comments')
    op.add_column('releasecomment', sa.Column('share_token_id', sa.Uuid(), nullable=True))
    op.add_column('releasecomment', sa.Column('author_email', sqlmodel.sql.sqltypes.AutoString(length=320), nullable=True))
    op.add_column('releasecomment', sa.Column('git_rev', sqlmodel.sql.sqltypes.AutoString(length=40), nullable=True))
    op.create_foreign_key(
        'releasecomment_share_token_id_fkey',
        'releasecomment',
        'releasesharetoken',
        ['share_token_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade():
    op.drop_constraint(
        'releasecomment_share_token_id_fkey', 'releasecomment', type_='foreignkey'
    )
    op.drop_column('releasecomment', 'git_rev')
    op.drop_column('releasecomment', 'author_email')
    op.drop_column('releasecomment', 'share_token_id')
    op.add_column(
        'release',
        sa.Column(
            'allow_anonymous_comments',
            sa.BOOLEAN(),
            server_default=sa.true(),
            nullable=False,
        ),
    )
    op.add_column(
        'release',
        sa.Column(
            'secret_token',
            sa.VARCHAR(length=64),
            server_default='',
            nullable=False,
        ),
    )
    op.create_index(
        op.f('ix_release_secret_token'), 'release', ['secret_token'], unique=True
    )
    op.drop_index(
        op.f('ix_releasesharetoken_token_hash'), table_name='releasesharetoken'
    )
    op.drop_table('releasesharetoken')
