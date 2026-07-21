"""add alias_bot to products

Revision ID: 076
Revises: 075
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = '076'
down_revision = '075'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('alias_bot', sa.String(length=40), nullable=True))


def downgrade():
    op.drop_column('products', 'alias_bot')
