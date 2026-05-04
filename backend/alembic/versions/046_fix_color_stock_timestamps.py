"""add missing timestamps to product_color_stock

Revision ID: 046
Revises: 045
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa

revision = '046'
down_revision = '045'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('product_color_stock',
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.add_column('product_color_stock',
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )


def downgrade() -> None:
    op.drop_column('product_color_stock', 'updated_at')
    op.drop_column('product_color_stock', 'created_at')
