"""add updated_at to admin_users

Revision ID: 054
Revises: 053
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = '054'
down_revision = '053'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'admin_users',
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_column('admin_users', 'updated_at')
