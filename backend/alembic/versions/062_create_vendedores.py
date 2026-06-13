"""create vendedores table

Revision ID: 062
Revises: 061
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = '062'
down_revision = '061'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'vendedores',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('nombre', sa.Text(), nullable=False),
        sa.Column('celular_wa', sa.Text(), nullable=False),
        sa.Column('email', sa.Text(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )


def downgrade():
    op.drop_table('vendedores')
