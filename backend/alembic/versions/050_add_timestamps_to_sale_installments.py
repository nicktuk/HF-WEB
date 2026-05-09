"""add timestamps to sale_installments

Revision ID: 050
Revises: 049
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = '050'
down_revision = '049'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'sale_installments',
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.add_column(
        'sale_installments',
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_column('sale_installments', 'updated_at')
    op.drop_column('sale_installments', 'created_at')
