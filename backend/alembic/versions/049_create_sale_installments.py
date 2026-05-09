"""create sale installments

Revision ID: 049
Revises: 048
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa

revision = '049'
down_revision = '048'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sale_installments',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('sale_id', sa.Integer(), sa.ForeignKey('sales.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('paid', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('sale_installments')
