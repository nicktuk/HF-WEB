"""add cantidad_minima to products

Revision ID: 084
Revises: 083
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa

revision = '084'
down_revision = '083'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('cantidad_minima', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('products', 'cantidad_minima')
