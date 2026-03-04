"""create app_settings table

Revision ID: 028_create_app_settings
Revises: 027_create_orders
Create Date: 2026-03-03
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "028_create_app_settings"
down_revision = "027_create_orders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
