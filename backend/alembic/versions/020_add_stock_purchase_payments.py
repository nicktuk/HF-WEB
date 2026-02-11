"""Add stock_purchase_payments table

Revision ID: 020
Revises: 019
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '020'
down_revision: Union[str, None] = '019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'stock_purchase_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stock_purchase_id', sa.Integer(), nullable=False),
        sa.Column('payer', sa.String(length=20), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('payment_method', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['stock_purchase_id'], ['stock_purchases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stock_purchase_payments_id'), 'stock_purchase_payments', ['id'], unique=False)
    op.create_index(op.f('ix_stock_purchase_payments_stock_purchase_id'), 'stock_purchase_payments', ['stock_purchase_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_stock_purchase_payments_stock_purchase_id'), table_name='stock_purchase_payments')
    op.drop_index(op.f('ix_stock_purchase_payments_id'), table_name='stock_purchase_payments')
    op.drop_table('stock_purchase_payments')
