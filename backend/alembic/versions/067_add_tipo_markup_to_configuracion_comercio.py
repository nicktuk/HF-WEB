"""add tipo_markup to configuracion_mayorista

Revision ID: 067
Revises: 066
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = '067'
down_revision = '066'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'configuracion_mayorista',
        sa.Column('tipo_markup', sa.String(10), nullable=False, server_default='fijo'),
    )


def downgrade():
    op.drop_column('configuracion_mayorista', 'tipo_markup')
