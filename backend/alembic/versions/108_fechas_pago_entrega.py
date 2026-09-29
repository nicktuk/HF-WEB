"""fechas de pago y de entrega en ventas minoristas y pedidos mayoristas

Minorista (el pago y la entrega se marcan por producto):
- sale_items.paid_at / sale_items.delivered_at: cuándo quedó pagado /
  entregado cada producto de la venta.

Mayorista (el pago es de todo el pedido; la entrega es por cantidad y puede
hacerse en varias veces):
- pedidos_mayoristas.fecha_pago: cuándo se registró el pago del pedido.
- pedido_mayorista_entregas: una fila por entrega (fecha, foto, quién la
  cargó), con el detalle de cuánto se entregó de cada producto en
  pedido_mayorista_entrega_items.

Backfill (no hay registro de las fechas reales anteriores):
- Productos minoristas pagados/entregados: si toda la venta quedó pagada /
  entregada, la fecha de estado_historial; si no la hay o la venta era
  parcial, la fecha de creación de la venta.
- Pedidos mayoristas pagados: fecha de creación del pedido.
- Pedidos mayoristas con algo entregado: una única entrega con lo entregado
  hasta hoy, la foto que había y la fecha de creación del pedido.

Revision ID: 108
Revises: 107
Create Date: 2026-09-29
"""
from alembic import op
import sqlalchemy as sa

revision = '108'
down_revision = '107'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sale_items', sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('sale_items', sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('pedidos_mayoristas', sa.Column('fecha_pago', sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        'pedido_mayorista_entregas',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'pedido_id', sa.Integer(),
            sa.ForeignKey('pedidos_mayoristas.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('fecha', sa.DateTime(timezone=True), nullable=False),
        sa.Column('foto_url', sa.Text(), nullable=True),
        sa.Column('origen', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_pedido_mayorista_entregas_pedido_id', 'pedido_mayorista_entregas', ['pedido_id'])

    op.create_table(
        'pedido_mayorista_entrega_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'entrega_id', sa.Integer(),
            sa.ForeignKey('pedido_mayorista_entregas.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column(
            'pedido_item_id', sa.Integer(),
            sa.ForeignKey('pedidos_mayoristas_items.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('cantidad', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_pedido_mayorista_entrega_items_entrega_id', 'pedido_mayorista_entrega_items', ['entrega_id'])
    op.create_index('ix_pedido_mayorista_entrega_items_pedido_item_id', 'pedido_mayorista_entrega_items', ['pedido_item_id'])

    conn = op.get_bind()

    # created_at y estado_historial.fecha son timestamps sin zona grabados en
    # UTC: AT TIME ZONE 'UTC' los convierte a timestamptz sin correrlos.
    for columna, estado, condicion_item, condicion_venta in (
        ('paid_at', 'pagada', 'si.is_paid', 's.paid'),
        ('delivered_at', 'entregada',
         'si.quantity > 0 AND si.delivered_quantity >= si.quantity', 's.delivered'),
    ):
        conn.execute(sa.text(f"""
            UPDATE sale_items si
            SET {columna} = COALESCE(
                CASE WHEN {condicion_venta} THEN (
                    SELECT MIN(eh.fecha) FROM estado_historial eh
                    WHERE eh.canal = 'minorista'
                      AND eh.referencia_id = s.id
                      AND eh.estado = '{estado}'
                ) END,
                s.created_at
            ) AT TIME ZONE 'UTC'
            FROM sales s
            WHERE s.id = si.sale_id AND {condicion_item}
        """))

    conn.execute(sa.text("""
        UPDATE pedidos_mayoristas
        SET fecha_pago = created_at AT TIME ZONE 'UTC'
        WHERE estado_pago = 'pagado'
    """))

    conn.execute(sa.text("""
        INSERT INTO pedido_mayorista_entregas (pedido_id, fecha, foto_url, origen)
        SELECT p.id, p.created_at AT TIME ZONE 'UTC', p.foto_entrega_url, 'migracion'
        FROM pedidos_mayoristas p
        WHERE EXISTS (
            SELECT 1 FROM pedidos_mayoristas_items i
            WHERE i.pedido_id = p.id AND i.cantidad_entregada > 0
        )
    """))
    conn.execute(sa.text("""
        INSERT INTO pedido_mayorista_entrega_items (entrega_id, pedido_item_id, cantidad)
        SELECT e.id, i.id, i.cantidad_entregada
        FROM pedido_mayorista_entregas e
        JOIN pedidos_mayoristas_items i ON i.pedido_id = e.pedido_id
        WHERE i.cantidad_entregada > 0
    """))


def downgrade():
    op.drop_index('ix_pedido_mayorista_entrega_items_pedido_item_id', table_name='pedido_mayorista_entrega_items')
    op.drop_index('ix_pedido_mayorista_entrega_items_entrega_id', table_name='pedido_mayorista_entrega_items')
    op.drop_table('pedido_mayorista_entrega_items')
    op.drop_index('ix_pedido_mayorista_entregas_pedido_id', table_name='pedido_mayorista_entregas')
    op.drop_table('pedido_mayorista_entregas')
    op.drop_column('pedidos_mayoristas', 'fecha_pago')
    op.drop_column('sale_items', 'delivered_at')
    op.drop_column('sale_items', 'paid_at')
