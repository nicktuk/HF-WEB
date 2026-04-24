"""Add is_on_demand to products

Revision ID: 042
Revises: 041
Create Date: 2026-04-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = '042'
down_revision = '041'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'products',
        sa.Column(
            'is_on_demand',
            sa.Boolean(),
            nullable=False,
            server_default='true',
            comment='Producto disponible solo por pedido (sin stock físico)',
        )
    )
    op.create_index('ix_products_is_on_demand', 'products', ['is_on_demand'])

    # Marcar is_on_demand=False para productos que tienen stock > 0
    op.execute(text("""
        UPDATE products
        SET is_on_demand = false
        WHERE id IN (
            SELECT product_id
            FROM stock_purchases
            GROUP BY product_id
            HAVING SUM(quantity - out_quantity) > 0
        )
    """))


def downgrade():
    op.drop_index('ix_products_is_on_demand', table_name='products')
    op.drop_column('products', 'is_on_demand')
