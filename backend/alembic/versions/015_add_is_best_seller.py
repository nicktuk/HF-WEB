"""Add is_best_seller field to products

Revision ID: 015
Revises: 014
Create Date: 2026-02-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'products',
        sa.Column(
            'is_best_seller',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment='Lo más vendido'
        )
    )
    op.create_index(
        'ix_products_is_best_seller',
        'products',
        ['is_best_seller']
    )


def downgrade():
    op.drop_index('ix_products_is_best_seller', table_name='products')
    op.drop_column('products', 'is_best_seller')
