"""Add publish_without_stock to products

Revision ID: 039
Revises: 038
Create Date: 2026-04-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '039'
down_revision = '038'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'products',
        sa.Column(
            'publish_without_stock',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment='URL directa activa pero oculto en el catálogo público',
        )
    )
    op.create_index('ix_products_publish_without_stock', 'products', ['publish_without_stock'])


def downgrade():
    op.drop_index('ix_products_publish_without_stock', table_name='products')
    op.drop_column('products', 'publish_without_stock')
