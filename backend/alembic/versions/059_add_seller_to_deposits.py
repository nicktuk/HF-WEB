"""add seller to deposits

Revision ID: 059
Revises: 058
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = '059'
down_revision = '058'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('deposits', sa.Column('seller', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('deposits', 'seller')
