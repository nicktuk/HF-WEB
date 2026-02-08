"""Add stock purchases table

Revision ID: 011
Revises: 010
Create Date: 2026-02-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'stock_purchases',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('code', sa.String(length=100), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=False),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('out_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            'product_id',
            'purchase_date',
            'unit_price',
            'quantity',
            'total_amount',
            name='uq_stock_purchases_dedupe'
        )
    )
    op.create_index('ix_stock_purchases_product_date', 'stock_purchases', ['product_id', 'purchase_date'])
    op.create_index('ix_stock_purchases_product_id', 'stock_purchases', ['product_id'])
    op.create_index('ix_stock_purchases_code', 'stock_purchases', ['code'])
    op.create_index('ix_stock_purchases_purchase_date', 'stock_purchases', ['purchase_date'])


def downgrade():
    op.drop_index('ix_stock_purchases_purchase_date', table_name='stock_purchases')
    op.drop_index('ix_stock_purchases_code', table_name='stock_purchases')
    op.drop_index('ix_stock_purchases_product_id', table_name='stock_purchases')
    op.drop_index('ix_stock_purchases_product_date', table_name='stock_purchases')
    op.drop_table('stock_purchases')
