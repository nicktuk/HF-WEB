"""create mp_pending_orders table (pedidos MP pendientes, confirmados por el webhook)

Revision ID: 079
Revises: 078
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '079'
down_revision = '078'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'mp_pending_orders',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=200), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('delivery_method', sa.String(length=20), nullable=True),
        sa.Column('shipping_zone', sa.String(length=20), nullable=True),
        sa.Column('items', postgresql.JSONB(), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('sale_id', sa.Integer(), sa.ForeignKey('sales.id'), nullable=True),
        sa.Column('mp_payment_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('mp_pending_orders')
