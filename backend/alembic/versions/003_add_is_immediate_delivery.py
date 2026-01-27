"""Add is_immediate_delivery column to products

Revision ID: 003
Revises: 002
Create Date: 2026-01-26

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'products',
        sa.Column(
            'is_immediate_delivery',
            sa.Boolean(),
            default=False,
            nullable=False,
            server_default=sa.text('false')
        )
    )
    op.create_index(
        'ix_products_is_immediate_delivery',
        'products',
        ['is_immediate_delivery']
    )


def downgrade() -> None:
    op.drop_index('ix_products_is_immediate_delivery', table_name='products')
    op.drop_column('products', 'is_immediate_delivery')
