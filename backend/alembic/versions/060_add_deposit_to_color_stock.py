"""add deposit_id to product_color_stock

Revision ID: 060
Revises: 059
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = '060'
down_revision = '059'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('product_color_stock', sa.Column('deposit_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_product_color_stock_deposit',
        'product_color_stock', 'deposits',
        ['deposit_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_product_color_stock_deposit_id', 'product_color_stock', ['deposit_id'])
    # Migrate existing rows to the first deposit
    op.execute("""
        UPDATE product_color_stock
        SET deposit_id = (SELECT id FROM deposits ORDER BY id LIMIT 1)
        WHERE deposit_id IS NULL AND EXISTS (SELECT 1 FROM deposits LIMIT 1)
    """)
    # Drop old unique index and create new one
    op.drop_index('ix_product_color_stock_product_color', table_name='product_color_stock')
    op.create_index(
        'ix_product_color_stock_product_color_deposit',
        'product_color_stock',
        ['product_id', 'color', 'deposit_id'],
        unique=True,
    )


def downgrade():
    op.drop_index('ix_product_color_stock_product_color_deposit', table_name='product_color_stock')
    op.create_index('ix_product_color_stock_product_color', 'product_color_stock', ['product_id', 'color'], unique=True)
    op.drop_index('ix_product_color_stock_deposit_id', table_name='product_color_stock')
    op.drop_constraint('fk_product_color_stock_deposit', 'product_color_stock', type_='foreignkey')
    op.drop_column('product_color_stock', 'deposit_id')
