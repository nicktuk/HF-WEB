"""add password reset fields to mayoristas (comercio)

Revision ID: 087
Revises: 086
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = '087'
down_revision = '086'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('mayoristas', sa.Column('reset_token_hash', sa.Text(), nullable=True))
    op.add_column('mayoristas', sa.Column('reset_token_expires_at', sa.DateTime(), nullable=True))
    op.add_column(
        'mayoristas',
        sa.Column('debe_cambiar_password', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column('mayoristas', 'debe_cambiar_password')
    op.drop_column('mayoristas', 'reset_token_expires_at')
    op.drop_column('mayoristas', 'reset_token_hash')
