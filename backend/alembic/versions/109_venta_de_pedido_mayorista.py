"""venta espejo de cada pedido mayorista

- sales.pedido_mayorista_id: la venta (origen='mayorista') que refleja un
  pedido de comercio en ventas, caja y reportes. A lo sumo una venta por
  pedido (índice único). La venta se genera y actualiza sola desde el pedido
  (ver services/comercio_pedidos.sincronizar_venta_pedido); no se edita a
  mano.

Sin backfill acá: las ventas de los pedidos ya existentes se generan con
POST /admin/comercios/pedidos/generar-ventas (previsualizable con GET).

Revision ID: 109
Revises: 108
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa

revision = '109'
down_revision = '108'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'sales',
        sa.Column(
            'pedido_mayorista_id',
            sa.Integer(),
            sa.ForeignKey('pedidos_mayoristas.id', ondelete='CASCADE'),
            nullable=True,
        ),
    )
    op.create_index('ix_sales_pedido_mayorista_id', 'sales', ['pedido_mayorista_id'], unique=True)


def downgrade():
    op.drop_index('ix_sales_pedido_mayorista_id', table_name='sales')
    op.drop_column('sales', 'pedido_mayorista_id')
