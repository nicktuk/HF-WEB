"""add deposits table and deposit_id to stock_purchases

Revision ID: 056
Revises: 055
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = '056'
down_revision = '055'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'deposits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index('ix_deposits_id', 'deposits', ['id'])

    # Insert default deposit
    op.execute("INSERT INTO deposits (name, is_active) VALUES ('DEPÓSITO 1', true)")

    # Add deposit_id column to stock_purchases
    op.add_column('stock_purchases', sa.Column('deposit_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_stock_purchases_deposit_id',
        'stock_purchases', 'deposits',
        ['deposit_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_stock_purchases_deposit_id', 'stock_purchases', ['deposit_id'])

    # Set all existing stock_purchases to the default deposit
    op.execute("UPDATE stock_purchases SET deposit_id = (SELECT id FROM deposits LIMIT 1)")


def downgrade():
    op.drop_index('ix_stock_purchases_deposit_id', table_name='stock_purchases')
    op.drop_constraint('fk_stock_purchases_deposit_id', 'stock_purchases', type_='foreignkey')
    op.drop_column('stock_purchases', 'deposit_id')
    op.drop_index('ix_deposits_id', table_name='deposits')
    op.drop_table('deposits')
