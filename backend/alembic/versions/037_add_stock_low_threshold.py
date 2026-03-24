"""Add stock_low_threshold to products

Revision ID: 037
Revises: 036
Create Date: 2026-03-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '037'
down_revision = '036_section_position'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'products',
        sa.Column(
            'stock_low_threshold',
            sa.Integer(),
            nullable=True,
            comment='Umbral de stock bajo por producto (override del global)',
        )
    )


def downgrade():
    op.drop_column('products', 'stock_low_threshold')
