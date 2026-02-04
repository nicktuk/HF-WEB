"""Add color and show_in_menu to categories

Revision ID: 007
Revises: 006
Create Date: 2026-02-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    # Add color column with default gray
    op.add_column(
        'categories',
        sa.Column('color', sa.String(7), nullable=False, server_default='#6b7280')
    )
    # Add show_in_menu column
    op.add_column(
        'categories',
        sa.Column('show_in_menu', sa.Boolean(), nullable=False, server_default=sa.false())
    )


def downgrade():
    op.drop_column('categories', 'show_in_menu')
    op.drop_column('categories', 'color')
