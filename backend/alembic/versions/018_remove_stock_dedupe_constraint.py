"""Remove unique constraint from stock_purchases to allow duplicate associations

Revision ID: 018
Revises: 017
Create Date: 2026-02-09

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    # Remove the unique constraint that prevents associating
    # the same stock purchase data to a product
    op.drop_constraint('uq_stock_purchases_dedupe', 'stock_purchases', type_='unique')


def downgrade():
    # Recreate the constraint (may fail if duplicates exist)
    op.create_unique_constraint(
        'uq_stock_purchases_dedupe',
        'stock_purchases',
        ['product_id', 'purchase_date', 'unit_price', 'quantity', 'total_amount']
    )
