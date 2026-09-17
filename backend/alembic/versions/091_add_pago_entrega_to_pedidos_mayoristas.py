"""add estado_pago, metodo_pago, foto_entrega_url to pedidos_mayoristas;
cantidad_entregada to pedidos_mayoristas_items; entrega_parcial state

Revision ID: 091
Revises: 090
Create Date: 2026-09-17
"""
from alembic import op
import sqlalchemy as sa

revision = '091'
down_revision = '090'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE TYPE estado_pago_pedido_mayorista_enum AS ENUM ('pendiente', 'pagado')"
    )
    op.add_column(
        'pedidos_mayoristas',
        sa.Column(
            'estado_pago',
            sa.Enum('pendiente', 'pagado', name='estado_pago_pedido_mayorista_enum', create_type=False),
            nullable=False,
            server_default='pendiente',
        ),
    )
    op.add_column('pedidos_mayoristas', sa.Column('metodo_pago', sa.Text(), nullable=True))
    op.add_column('pedidos_mayoristas', sa.Column('foto_entrega_url', sa.Text(), nullable=True))

    op.add_column(
        'pedidos_mayoristas_items',
        sa.Column('cantidad_entregada', sa.Integer(), nullable=False, server_default='0'),
    )

    op.execute(
        "ALTER TYPE estado_pedido_mayorista_enum ADD VALUE IF NOT EXISTS 'entrega_parcial'"
    )


def downgrade():
    op.drop_column('pedidos_mayoristas_items', 'cantidad_entregada')
    op.drop_column('pedidos_mayoristas', 'foto_entrega_url')
    op.drop_column('pedidos_mayoristas', 'metodo_pago')
    op.drop_column('pedidos_mayoristas', 'estado_pago')
    op.execute("DROP TYPE IF EXISTS estado_pago_pedido_mayorista_enum")
    # No se puede quitar un valor de un ENUM de Postgres sin recrear el tipo;
    # 'entrega_parcial' queda en el enum tras el downgrade.
