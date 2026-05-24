"""add updated_at to deposits table

Revision ID: 057
Revises: 056
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = '057'
down_revision = '056'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'deposits',
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_column('deposits', 'updated_at')
