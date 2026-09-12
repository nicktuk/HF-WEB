"""add activated_at to products

Revision ID: 088
Revises: 087
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = '088'
down_revision = '087'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('activated_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('products', 'activated_at')
