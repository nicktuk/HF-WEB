"""tabla estado_historial para el flujo de fechas por estado en Mis ventas

Bitácora de transiciones de estado, tanto de pedidos mayoristas
(pedidos_mayoristas.estado) como de ventas minoristas (sales.paid/delivered).
No hay FK a una tabla puntual porque `referencia_id` apunta a una de las dos
según `canal` — se resuelve en la capa de servicio.

Backfill: una sola fila por pedido/venta existente con su estado actual (no
hay forma de reconstruir transiciones pasadas que nunca se registraron); de
acá en más cada cambio de estado relevante para el vendedor queda anotado
con su fecha real.

Revision ID: 100
Revises: 099
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = '100'
down_revision = '099'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'estado_historial',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('canal', sa.String(20), nullable=False),
        sa.Column('referencia_id', sa.Integer(), nullable=False),
        sa.Column('estado', sa.Text(), nullable=False),
        sa.Column('fecha', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        # created_at/updated_at: todo modelo hereda estas dos de app.models.base.Base.
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_estado_historial_canal', 'estado_historial', ['canal'])
    op.create_index('ix_estado_historial_referencia_id', 'estado_historial', ['referencia_id'])
    op.create_index('ix_estado_historial_canal_referencia', 'estado_historial', ['canal', 'referencia_id'])

    conn = op.get_bind()

    conn.execute(sa.text("""
        INSERT INTO estado_historial (canal, referencia_id, estado, fecha)
        SELECT 'mayorista', id, estado, COALESCE(modificado_at, created_at)
        FROM pedidos_mayoristas
    """))

    conn.execute(sa.text("""
        INSERT INTO estado_historial (canal, referencia_id, estado, fecha)
        SELECT 'minorista', id,
               CASE
                   WHEN delivered THEN 'entregada'
                   WHEN paid THEN 'pagada'
                   ELSE 'pendiente_pago'
               END,
               updated_at
        FROM sales
    """))


def downgrade():
    op.drop_index('ix_estado_historial_canal_referencia', table_name='estado_historial')
    op.drop_index('ix_estado_historial_referencia_id', table_name='estado_historial')
    op.drop_index('ix_estado_historial_canal', table_name='estado_historial')
    op.drop_table('estado_historial')
