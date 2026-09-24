"""comisión minorista por matriz semanal (tramos por monto + % ofertas)

Reemplaza la tasa minorista única (general y por vendedor) por una matriz
de tramos según el volumen de venta semanal (lunes a domingo) del vendedor,
con opción de cálculo escalonado o sobre toda la venta, más un % aparte
para los productos vendidos en oferta.

- comision_minorista_tramos: cada fila aplica cuando la venta semanal
  supera `monto_desde` (el primer tramo arranca en 0).
- configuracion_mayorista: comision_minorista_oferta_porcentaje y
  comision_minorista_escalonada. Se borra comision_minorista_porcentaje,
  migrando su valor al tramo inicial (desde 0) para no cambiar el cálculo
  hasta que se cargue la matriz.
- catalog_sellers: se borra comision_minorista_porcentaje (ya no hay % por
  vendedor en minorista).
- sale_items.es_oferta: snapshot de si el producto estaba en oferta al
  cargarse la venta (las ventas previas quedan como no-oferta).
- comisiones.base_oferta: parte de la base vendida en oferta.

Revision ID: 104
Revises: 103
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa

revision = '104'
down_revision = '103'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'comision_minorista_tramos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('monto_desde', sa.Numeric(12, 2), nullable=False),
        sa.Column('porcentaje', sa.Numeric(5, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('monto_desde', name='uq_comision_minorista_tramos_monto_desde'),
    )
    op.execute(
        "INSERT INTO comision_minorista_tramos (monto_desde, porcentaje) "
        "SELECT 0, comision_minorista_porcentaje FROM configuracion_mayorista LIMIT 1"
    )

    op.add_column(
        'configuracion_mayorista',
        sa.Column('comision_minorista_oferta_porcentaje', sa.Numeric(5, 2), nullable=False, server_default='0'),
    )
    op.add_column(
        'configuracion_mayorista',
        sa.Column('comision_minorista_escalonada', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.drop_column('configuracion_mayorista', 'comision_minorista_porcentaje')
    op.drop_column('catalog_sellers', 'comision_minorista_porcentaje')

    op.add_column(
        'sale_items',
        sa.Column('es_oferta', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'comisiones',
        sa.Column('base_oferta', sa.Numeric(12, 2), nullable=False, server_default='0'),
    )


def downgrade():
    op.drop_column('comisiones', 'base_oferta')
    op.drop_column('sale_items', 'es_oferta')
    op.add_column('catalog_sellers', sa.Column('comision_minorista_porcentaje', sa.Numeric(5, 2), nullable=True))
    op.add_column(
        'configuracion_mayorista',
        sa.Column('comision_minorista_porcentaje', sa.Numeric(5, 2), nullable=False, server_default='0'),
    )
    op.execute(
        "UPDATE configuracion_mayorista SET comision_minorista_porcentaje = COALESCE("
        "(SELECT porcentaje FROM comision_minorista_tramos ORDER BY monto_desde LIMIT 1), 0)"
    )
    op.drop_column('configuracion_mayorista', 'comision_minorista_escalonada')
    op.drop_column('configuracion_mayorista', 'comision_minorista_oferta_porcentaje')
    op.drop_table('comision_minorista_tramos')
