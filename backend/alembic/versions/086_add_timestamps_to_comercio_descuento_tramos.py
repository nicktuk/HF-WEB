"""add created_at/updated_at to comercio_descuento_tramos (Base model requires them)

Revision ID: 086
Revises: 085
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = '086'
down_revision = '085'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'comercio_descuento_tramos',
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.add_column(
        'comercio_descuento_tramos',
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_column('comercio_descuento_tramos', 'updated_at')
    op.drop_column('comercio_descuento_tramos', 'created_at')
