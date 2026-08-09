"""add shipping address fields to sales and mp_pending_orders

Revision ID: 080
Revises: 079
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = '080'
down_revision = '079'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sales', sa.Column('delivery_method', sa.String(length=20), nullable=True))
    op.add_column('sales', sa.Column('shipping_zone', sa.String(length=20), nullable=True))
    op.add_column('sales', sa.Column('shipping_street', sa.String(length=255), nullable=True))
    op.add_column('sales', sa.Column('shipping_floor_apt', sa.String(length=100), nullable=True))
    op.add_column('sales', sa.Column('shipping_city', sa.String(length=150), nullable=True))
    op.add_column('sales', sa.Column('shipping_province', sa.String(length=100), nullable=True))
    op.add_column('sales', sa.Column('shipping_postal_code', sa.String(length=20), nullable=True))
    op.add_column('sales', sa.Column('shipping_reference', sa.String(length=255), nullable=True))

    op.add_column('mp_pending_orders', sa.Column('shipping_street', sa.String(length=255), nullable=True))
    op.add_column('mp_pending_orders', sa.Column('shipping_floor_apt', sa.String(length=100), nullable=True))
    op.add_column('mp_pending_orders', sa.Column('shipping_city', sa.String(length=150), nullable=True))
    op.add_column('mp_pending_orders', sa.Column('shipping_province', sa.String(length=100), nullable=True))
    op.add_column('mp_pending_orders', sa.Column('shipping_postal_code', sa.String(length=20), nullable=True))
    op.add_column('mp_pending_orders', sa.Column('shipping_reference', sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column('mp_pending_orders', 'shipping_reference')
    op.drop_column('mp_pending_orders', 'shipping_postal_code')
    op.drop_column('mp_pending_orders', 'shipping_province')
    op.drop_column('mp_pending_orders', 'shipping_city')
    op.drop_column('mp_pending_orders', 'shipping_floor_apt')
    op.drop_column('mp_pending_orders', 'shipping_street')

    op.drop_column('sales', 'shipping_reference')
    op.drop_column('sales', 'shipping_postal_code')
    op.drop_column('sales', 'shipping_province')
    op.drop_column('sales', 'shipping_city')
    op.drop_column('sales', 'shipping_floor_apt')
    op.drop_column('sales', 'shipping_street')
    op.drop_column('sales', 'shipping_zone')
    op.drop_column('sales', 'delivery_method')
