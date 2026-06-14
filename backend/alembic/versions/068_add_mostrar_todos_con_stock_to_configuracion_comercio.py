"""add mostrar_todos_con_stock to configuracion_mayorista

Revision ID: 068
Revises: 067
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = '068'
down_revision = '067'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'configuracion_mayorista',
        sa.Column('mostrar_todos_con_stock', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_column('configuracion_mayorista', 'mostrar_todos_con_stock')
