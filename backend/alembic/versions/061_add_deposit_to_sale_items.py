"""add deposit_id to sale_items

Revision ID: 061
Revises: 060
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = '061'
down_revision = '060'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sale_items', sa.Column('deposit_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_sale_items_deposit_id',
        'sale_items', 'deposits',
        ['deposit_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade():
    op.drop_constraint('fk_sale_items_deposit_id', 'sale_items', type_='foreignkey')
    op.drop_column('sale_items', 'deposit_id')
