"""Add is_check_stock column to products

Revision ID: 004
Revises: 003
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'products',
        sa.Column(
            'is_check_stock',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment='Consultar stock (excluye nuevo e inmediata)'
        )
    )
    op.create_index(
        'ix_products_is_check_stock',
        'products',
        ['is_check_stock']
    )


def downgrade():
    op.drop_index('ix_products_is_check_stock', table_name='products')
    op.drop_column('products', 'is_check_stock')
