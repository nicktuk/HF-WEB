"""add iconos json column to product_comercio_config

Revision ID: 090
Revises: 089
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = '090'
down_revision = '089'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('product_comercio_config', sa.Column('iconos', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('product_comercio_config', 'iconos')
