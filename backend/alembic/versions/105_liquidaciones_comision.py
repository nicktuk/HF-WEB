"""liquidaciones semanales de comisiones

Crea liquidaciones_comision (un pago a un vendedor por una semana lunes a
domingo, hora Argentina) y agrega comisiones.liquidacion_id. Las comisiones
que ya estaban marcadas como liquidadas se agrupan en liquidaciones
históricas por vendedor y semana de generación (sin gasto asociado), para
que no queden liquidadas sin liquidación.

Revision ID: 105
Revises: 104
Create Date: 2026-09-24
"""
from alembic import op
import sqlalchemy as sa

revision = '105'
down_revision = '104'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'liquidaciones_comision',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('vendedor_id', sa.Integer(), sa.ForeignKey('catalog_sellers.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('semana_desde', sa.Date(), nullable=False),
        sa.Column('semana_hasta', sa.Date(), nullable=False),
        sa.Column('fecha_pago', sa.Date(), nullable=False),
        sa.Column('total', sa.Numeric(12, 2), nullable=False),
        sa.Column('medio_pago', sa.String(100), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('estado', sa.String(20), nullable=False, server_default='confirmada'),
        sa.Column('expense_id', sa.Integer(), sa.ForeignKey('expenses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_liquidaciones_comision_id', 'liquidaciones_comision', ['id'])
    op.create_index('ix_liquidaciones_comision_vendedor_id', 'liquidaciones_comision', ['vendedor_id'])
    op.create_index('ix_liquidaciones_comision_semana_desde', 'liquidaciones_comision', ['semana_desde'])

    op.add_column(
        'comisiones',
        sa.Column(
            'liquidacion_id',
            sa.Integer(),
            sa.ForeignKey('liquidaciones_comision.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_comisiones_liquidacion_id', 'comisiones', ['liquidacion_id'])

    # created_at se guarda en UTC sin zona; la semana se corta en hora
    # Argentina (UTC-3). date_trunc('week') devuelve el lunes.
    op.execute("""
        INSERT INTO liquidaciones_comision
            (vendedor_id, semana_desde, semana_hasta, fecha_pago, total, notas, estado)
        SELECT
            vendedor_id,
            date_trunc('week', created_at - interval '3 hours')::date,
            date_trunc('week', created_at - interval '3 hours')::date + 6,
            date_trunc('week', created_at - interval '3 hours')::date + 6,
            SUM(monto),
            'Histórica: comisiones marcadas como liquidadas antes de existir las liquidaciones semanales',
            'confirmada'
        FROM comisiones
        WHERE estado = 'liquidada'
        GROUP BY vendedor_id, date_trunc('week', created_at - interval '3 hours')::date
    """)
    op.execute("""
        UPDATE comisiones c
        SET liquidacion_id = l.id
        FROM liquidaciones_comision l
        WHERE c.estado = 'liquidada'
          AND l.vendedor_id = c.vendedor_id
          AND l.semana_desde = date_trunc('week', c.created_at - interval '3 hours')::date
    """)


def downgrade():
    op.drop_index('ix_comisiones_liquidacion_id', table_name='comisiones')
    op.drop_column('comisiones', 'liquidacion_id')
    op.drop_table('liquidaciones_comision')
