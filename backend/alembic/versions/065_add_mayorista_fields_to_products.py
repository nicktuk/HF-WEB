"""add es_mayorista and precio_mayorista_override to products

Revision ID: 065
Revises: 064
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = '065'
down_revision = '064'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('es_mayorista', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('products', sa.Column('precio_mayorista_override', sa.Numeric(12, 2), nullable=True))
    op.create_index('ix_products_es_mayorista', 'products', ['es_mayorista'])


def downgrade():
    op.drop_index('ix_products_es_mayorista', 'products')
    op.drop_column('products', 'precio_mayorista_override')
    op.drop_column('products', 'es_mayorista')
