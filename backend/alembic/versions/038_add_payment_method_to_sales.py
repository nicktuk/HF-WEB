"""Add payment_method to sales

Revision ID: 038
Revises: 037
Create Date: 2026-04-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '038'
down_revision = '037'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'sales',
        sa.Column('payment_method', sa.String(100), nullable=True)
    )


def downgrade():
    op.drop_column('sales', 'payment_method')
