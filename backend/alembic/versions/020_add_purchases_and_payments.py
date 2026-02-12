"""Add purchases and payments tables

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
    # Create purchases table
    op.create_table(
        'purchases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('supplier', sa.String(length=200), nullable=False),
        sa.Column('purchase_date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_purchases_id'), 'purchases', ['id'], unique=False)
    op.create_index(op.f('ix_purchases_supplier'), 'purchases', ['supplier'], unique=False)
    op.create_index(op.f('ix_purchases_purchase_date'), 'purchases', ['purchase_date'], unique=False)

    # Create purchase_payments table
    op.create_table(
        'purchase_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_id', sa.Integer(), nullable=False),
        sa.Column('payer', sa.String(length=20), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('payment_method', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['purchase_id'], ['purchases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_purchase_payments_id'), 'purchase_payments', ['id'], unique=False)
    op.create_index(op.f('ix_purchase_payments_purchase_id'), 'purchase_payments', ['purchase_id'], unique=False)

    # Add purchase_id to stock_purchases
    op.add_column('stock_purchases', sa.Column('purchase_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_stock_purchases_purchase_id'), 'stock_purchases', ['purchase_id'], unique=False)
    op.create_foreign_key(
        'fk_stock_purchases_purchase_id',
        'stock_purchases',
        'purchases',
        ['purchase_id'],
        ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    # Remove purchase_id from stock_purchases
    op.drop_constraint('fk_stock_purchases_purchase_id', 'stock_purchases', type_='foreignkey')
    op.drop_index(op.f('ix_stock_purchases_purchase_id'), table_name='stock_purchases')
    op.drop_column('stock_purchases', 'purchase_id')

    # Drop purchase_payments table
    op.drop_index(op.f('ix_purchase_payments_purchase_id'), table_name='purchase_payments')
    op.drop_index(op.f('ix_purchase_payments_id'), table_name='purchase_payments')
    op.drop_table('purchase_payments')

    # Drop purchases table
    op.drop_index(op.f('ix_purchases_purchase_date'), table_name='purchases')
    op.drop_index(op.f('ix_purchases_supplier'), table_name='purchases')
    op.drop_index(op.f('ix_purchases_id'), table_name='purchases')
    op.drop_table('purchases')
