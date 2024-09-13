"""Update subscription model to use plan instead of type

Revision ID: 38e178698db2
Revises: 4dac15c0282a
Create Date: 2024-09-13 16:02:06.986653

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "38e178698db2"
down_revision = "4dac15c0282a"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "discountcode", sa.Column("plan_id", sa.Integer(), nullable=False)
    )
    op.drop_column("discountcode", "subscription_type_id")
    op.add_column(
        "orgsubscription", sa.Column("plan_id", sa.Integer(), nullable=False)
    )
    op.add_column(
        "orgsubscription",
        sa.Column(
            "processor_product_id",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        ),
    )
    op.add_column(
        "orgsubscription",
        sa.Column(
            "processor_price_id",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        ),
    )
    op.drop_column("orgsubscription", "processor_plan_id")
    op.drop_column("orgsubscription", "type_id")
    op.add_column(
        "usersubscription", sa.Column("plan_id", sa.Integer(), nullable=False)
    )
    op.add_column(
        "usersubscription",
        sa.Column(
            "processor_product_id",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        ),
    )
    op.add_column(
        "usersubscription",
        sa.Column(
            "processor_price_id",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        ),
    )
    op.drop_column("usersubscription", "processor_plan_id")
    op.drop_column("usersubscription", "type_id")
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "usersubscription",
        sa.Column(
            "type_id", sa.INTEGER(), autoincrement=False, nullable=False
        ),
    )
    op.add_column(
        "usersubscription",
        sa.Column(
            "processor_plan_id",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.drop_column("usersubscription", "processor_price_id")
    op.drop_column("usersubscription", "processor_product_id")
    op.drop_column("usersubscription", "plan_id")
    op.add_column(
        "orgsubscription",
        sa.Column(
            "type_id", sa.INTEGER(), autoincrement=False, nullable=False
        ),
    )
    op.add_column(
        "orgsubscription",
        sa.Column(
            "processor_plan_id",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.drop_column("orgsubscription", "processor_price_id")
    op.drop_column("orgsubscription", "processor_product_id")
    op.drop_column("orgsubscription", "plan_id")
    op.add_column(
        "discountcode",
        sa.Column(
            "subscription_type_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.drop_column("discountcode", "plan_id")
    # ### end Alembic commands ###