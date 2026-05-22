"""create customers table

Revision ID: 055
Revises: 054
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = '055'
down_revision = '054'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'customers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('email', sa.String(200), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index('ix_customers_id', 'customers', ['id'])
    op.create_index('ix_customers_name', 'customers', ['name'])


def downgrade():
    op.drop_index('ix_customers_name', table_name='customers')
    op.drop_index('ix_customers_id', table_name='customers')
    op.drop_table('customers')
