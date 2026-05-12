"""add color to sale_items

Revision ID: 051
Revises: 050
Create Date: 2026-05-11
"""
from alembic import op
import sqlalchemy as sa

revision = '051'
down_revision = '050'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'sale_items',
        sa.Column('color', sa.String(20), nullable=True),
    )


def downgrade():
    op.drop_column('sale_items', 'color')
