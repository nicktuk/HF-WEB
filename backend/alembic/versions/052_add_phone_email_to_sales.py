"""add phone and email to sales

Revision ID: 052
Revises: 051
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = '052'
down_revision = '051'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'sales',
        sa.Column('phone', sa.String(50), nullable=True),
    )
    op.add_column(
        'sales',
        sa.Column('email', sa.String(200), nullable=True),
    )


def downgrade():
    op.drop_column('sales', 'email')
    op.drop_column('sales', 'phone')
