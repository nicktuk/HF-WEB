"""Add is_best_seller field to products and clear old featured

Revision ID: 019
Revises: 018
Create Date: 2026-02-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '019'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade():
    # Add column if not exists
    op.execute("""
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN NOT NULL DEFAULT false
    """)

    # Create index if not exists
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_products_is_best_seller
        ON products (is_best_seller)
    """)

    # Remove "Nuevo" badge from products NOT scraped today
    op.execute("""
        UPDATE products
        SET is_featured = false
        WHERE is_featured = true
          AND (last_scraped_at IS NULL OR last_scraped_at::date < CURRENT_DATE)
    """)


def downgrade():
    op.drop_index('ix_products_is_best_seller', table_name='products')
    op.drop_column('products', 'is_best_seller')
