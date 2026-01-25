"""Add is_featured column to products

Revision ID: 002
Revises: 001
Create Date: 2026-01-24

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_featured column to products table
    op.add_column(
        'products',
        sa.Column('is_featured', sa.Boolean(), default=False, nullable=False, server_default=sa.text('false'))
    )

    # Add index for querying featured products
    op.create_index(
        'ix_products_is_featured',
        'products',
        ['is_featured']
    )


def downgrade() -> None:
    op.drop_index('ix_products_is_featured', table_name='products')
    op.drop_column('products', 'is_featured')
