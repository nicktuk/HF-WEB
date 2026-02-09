"""Create sales and sale_items tables

Revision ID: 013
Revises: 012
Create Date: 2026-02-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sales',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('customer_name', sa.String(length=200), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('installments', sa.Integer(), nullable=True),
        sa.Column('seller', sa.String(length=20), nullable=False, server_default='Facu'),
        sa.Column('delivered', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('paid', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'sale_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sale_id', sa.Integer(), sa.ForeignKey('sales.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('total_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    op.create_index('ix_sale_items_sale_id', 'sale_items', ['sale_id'])
    op.create_index('ix_sale_items_product_id', 'sale_items', ['product_id'])
    op.create_index('ix_sale_items_sale_product', 'sale_items', ['sale_id', 'product_id'])


def downgrade():
    op.drop_index('ix_sale_items_sale_product', table_name='sale_items')
    op.drop_index('ix_sale_items_product_id', table_name='sale_items')
    op.drop_index('ix_sale_items_sale_id', table_name='sale_items')
    op.drop_table('sale_items')
    op.drop_table('sales')
