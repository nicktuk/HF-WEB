"""add is_published to products

Revision ID: 029_add_is_published_to_products
Revises: 028_create_app_settings
Create Date: 2026-03-09
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "029_add_is_published_to_products"
down_revision = "028_create_app_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_products_is_published", "products", ["is_published"])


def downgrade() -> None:
    op.drop_index("ix_products_is_published", table_name="products")
    op.drop_column("products", "is_published")
