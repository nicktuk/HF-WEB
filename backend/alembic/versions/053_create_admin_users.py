"""create admin_users table

Revision ID: 053
Revises: 052
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = '053'
down_revision = '052'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'admin_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('api_key', sa.String(128), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='superadmin'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('api_key'),
    )
    op.create_index('ix_admin_users_api_key', 'admin_users', ['api_key'])


def downgrade():
    op.drop_index('ix_admin_users_api_key', table_name='admin_users')
    op.drop_table('admin_users')
