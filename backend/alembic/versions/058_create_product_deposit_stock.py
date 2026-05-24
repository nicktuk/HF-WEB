"""create product_deposit_stock table

Revision ID: 058
Revises: 057
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = '058'
down_revision = '057'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'product_deposit_stock',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('deposit_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['deposit_id'], ['deposits.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_product_deposit_stock_id', 'product_deposit_stock', ['id'])
    op.create_index(
        'ix_product_deposit_stock_product_deposit',
        'product_deposit_stock',
        ['product_id', 'deposit_id'],
        unique=True,
    )


def downgrade():
    op.drop_index('ix_product_deposit_stock_product_deposit', table_name='product_deposit_stock')
    op.drop_index('ix_product_deposit_stock_id', table_name='product_deposit_stock')
    op.drop_table('product_deposit_stock')
