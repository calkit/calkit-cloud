"""Make account github_name nullable

Allows accounts created without GitHub (email/Google signup). Project owners
must still have a github_name (enforced in the app layer) until git hosting is
decoupled from GitHub; collaborators need not.

Revision ID: f3a9c1d2b4e6
Revises: f3a9c1b7e240
Create Date: 2026-06-17 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f3a9c1d2b4e6"
down_revision = "f3a9c1b7e240"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "account", "github_name", existing_type=sa.VARCHAR(), nullable=True
    )


def downgrade():
    # Note: rows with NULL github_name (GitHub-less accounts) must be handled
    # before downgrading, or this will fail.
    op.alter_column(
        "account", "github_name", existing_type=sa.VARCHAR(), nullable=False
    )
