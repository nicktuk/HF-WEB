"""create configuracion_mayorista table with seed row

Revision ID: 064
Revises: 063
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = '064'
down_revision = '063'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'configuracion_mayorista',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('descuento_porcentaje', sa.Numeric(5, 2), nullable=False, server_default='25'),
        sa.Column('redondeo', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('monto_minimo_pedido', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )
    op.execute(
        "INSERT INTO configuracion_mayorista (descuento_porcentaje, redondeo, monto_minimo_pedido) "
        "VALUES (25, 100, 0)"
    )


def downgrade():
    op.drop_table('configuracion_mayorista')
