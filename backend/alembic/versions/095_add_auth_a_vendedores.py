"""add auth fields to vendedores (usuario, password_hash, reset token)

Revision ID: 095
Revises: 094
Create Date: 2026-09-17
"""
from alembic import op
import sqlalchemy as sa

revision = '095'
down_revision = '094'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('vendedores', sa.Column('usuario', sa.Text(), nullable=True))
    op.add_column('vendedores', sa.Column('password_hash', sa.Text(), nullable=True))
    op.add_column('vendedores', sa.Column('reset_token_hash', sa.Text(), nullable=True))
    op.add_column('vendedores', sa.Column('reset_token_expires_at', sa.DateTime(), nullable=True))
    op.add_column(
        'vendedores',
        sa.Column('debe_cambiar_password', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.create_index('ix_vendedores_usuario', 'vendedores', ['usuario'], unique=True)


def downgrade():
    op.drop_index('ix_vendedores_usuario', table_name='vendedores')
    op.drop_column('vendedores', 'debe_cambiar_password')
    op.drop_column('vendedores', 'reset_token_expires_at')
    op.drop_column('vendedores', 'reset_token_hash')
    op.drop_column('vendedores', 'password_hash')
    op.drop_column('vendedores', 'usuario')
