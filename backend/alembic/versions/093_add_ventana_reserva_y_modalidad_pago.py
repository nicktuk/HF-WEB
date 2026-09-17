"""add fecha_reserva_hasta + cancelado_por_vencimiento to pedidos_mayoristas;
modalidad_pago to mayoristas

Revision ID: 093
Revises: 092
Create Date: 2026-09-17
"""
from alembic import op
import sqlalchemy as sa

revision = '093'
down_revision = '092'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE TYPE modalidad_pago_mayorista_enum AS ENUM ('normal', 'anticipado')"
    )
    op.add_column(
        'mayoristas',
        sa.Column(
            'modalidad_pago',
            sa.Enum('normal', 'anticipado', name='modalidad_pago_mayorista_enum', create_type=False),
            nullable=False,
            server_default='normal',
        ),
    )
    op.add_column('pedidos_mayoristas', sa.Column('fecha_reserva_hasta', sa.DateTime(), nullable=True))
    op.add_column(
        'pedidos_mayoristas',
        sa.Column('cancelado_por_vencimiento', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_column('pedidos_mayoristas', 'cancelado_por_vencimiento')
    op.drop_column('pedidos_mayoristas', 'fecha_reserva_hasta')
    op.drop_column('mayoristas', 'modalidad_pago')
    op.execute("DROP TYPE IF EXISTS modalidad_pago_mayorista_enum")
