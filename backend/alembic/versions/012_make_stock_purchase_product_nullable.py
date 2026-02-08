"""Make stock purchases product_id nullable

Revision ID: 012
Revises: 011
Create Date: 2026-02-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('stock_purchases', 'product_id', existing_type=sa.Integer(), nullable=True)


def downgrade():
    op.alter_column('stock_purchases', 'product_id', existing_type=sa.Integer(), nullable=False)
