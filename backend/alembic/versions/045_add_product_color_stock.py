"""add product_color_stock table

Revision ID: 045
Revises: 044
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa

revision = '045'
down_revision = '044'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'product_color_stock',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('color', sa.String(20), nullable=False, comment='Color hex'),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_product_color_stock_id', 'product_color_stock', ['id'])
    op.create_index('ix_product_color_stock_product_color', 'product_color_stock', ['product_id', 'color'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_product_color_stock_product_color', table_name='product_color_stock')
    op.drop_index('ix_product_color_stock_id', table_name='product_color_stock')
    op.drop_table('product_color_stock')
