"""precio mayorista propio por producto

El precio del canal comercios deja de calcularse a partir del precio
minorista (modo 'descuento') o del costo (modo 'markup'): cada producto
tiene su propio precio mayorista, y la matriz de descuento por cantidad
se aplica sobre ese precio.

- product_comercio_config.precio_mayorista_override pasa a llamarse
  precio_mayorista.
- A los productos mayoristas sin precio manual se les carga el precio que
  mostraban hasta hoy (según la config vigente), para que el cambio no
  altere ningún precio el día del deploy.

Las columnas de configuracion_mayorista que ya no se usan (modo_precio,
tipo_markup, descuento_porcentaje, mostrar_todos_con_stock) quedan en la
base sin uso.

Revision ID: 107
Revises: 106
Create Date: 2026-09-28
"""
import math

from alembic import op
import sqlalchemy as sa

revision = '107'
down_revision = '106'
branch_labels = None
depends_on = None


def _final_price(custom_price, original_price, markup_percentage):
    # Espeja Product.final_price al momento de esta migración.
    if custom_price is not None and float(custom_price) > 0:
        return math.ceil(float(custom_price))
    if original_price is not None and float(original_price) > 0:
        return math.ceil(float(original_price) * (1 + float(markup_percentage or 0) / 100))
    return None


def upgrade():
    conn = op.get_bind()

    cfg = conn.execute(sa.text(
        "SELECT descuento_porcentaje, redondeo, tipo_markup, modo_precio "
        "FROM configuracion_mayorista LIMIT 1"
    )).first()
    descuento_porcentaje = float(cfg.descuento_porcentaje) if cfg else 25.0
    redondeo = int(cfg.redondeo) if cfg else 100
    tipo_markup = (cfg.tipo_markup if cfg else None) or 'fijo'
    modo_precio = (cfg.modo_precio if cfg else None) or 'markup'

    rows = conn.execute(sa.text(
        """
        SELECT c.id, p.custom_price, p.original_price, p.markup_percentage,
               (SELECT sp.unit_price FROM stock_purchases sp
                 WHERE sp.product_id = p.id
                 ORDER BY sp.purchase_date DESC LIMIT 1) AS costo
        FROM product_comercio_config c
        JOIN products p ON p.id = c.product_id
        WHERE c.es_mayorista = true AND c.precio_mayorista_override IS NULL
        """
    )).fetchall()

    for r in rows:
        precio_venta = _final_price(r.custom_price, r.original_price, r.markup_percentage)
        if modo_precio == 'descuento':
            if precio_venta is None:
                continue
            precio = int(precio_venta)
        else:
            costo = r.costo if r.costo is not None else r.original_price
            if costo is None:
                continue
            if tipo_markup == 'variable' and precio_venta is not None:
                precio = (float(costo) + float(precio_venta)) / 2
            else:
                precio = float(costo) * (1 + descuento_porcentaje / 100)
            if redondeo > 0:
                precio = math.ceil(precio / redondeo) * redondeo
            precio = int(precio)
        conn.execute(
            sa.text("UPDATE product_comercio_config SET precio_mayorista_override = :precio WHERE id = :id"),
            {"precio": precio, "id": r.id},
        )

    op.alter_column(
        'product_comercio_config', 'precio_mayorista_override',
        new_column_name='precio_mayorista',
        existing_type=sa.Numeric(12, 2),
        existing_nullable=True,
        comment='Precio mayorista del producto (base de la matriz de descuento por cantidad)',
    )


def downgrade():
    op.alter_column(
        'product_comercio_config', 'precio_mayorista',
        new_column_name='precio_mayorista_override',
        existing_type=sa.Numeric(12, 2),
        existing_nullable=True,
        comment='Precio comercio manual (pisa el cálculo por regla)',
    )
