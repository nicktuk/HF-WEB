"""Create import_scorer schema with all tables

Revision ID: 047
Revises: 046
Create Date: 2026-05-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSON

revision = '047'
down_revision = '046'
branch_labels = None
depends_on = None

SCHEMA = "import_scorer"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "import_rubro_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False, unique=True),
        sa.Column("descripcion", sa.Text, nullable=True),
        sa.Column("retailers_recomendados", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("outlets_recomendados", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("margen_minimo_verde", sa.Float, nullable=False, server_default="2.5"),
        sa.Column("margen_minimo_amarillo", sa.Float, nullable=False, server_default="1.8"),
        sa.Column("top_n_scraping_default", sa.Integer, nullable=False, server_default="50"),
        sa.Column("dias_rotacion_esperada", sa.Integer, nullable=True),
        sa.Column("flag_restriccion", sa.String(100), nullable=True),
        sa.Column("palabras_clave_default", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("blacklist_default", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_rubros",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False, unique=True),
        sa.Column("template_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.import_rubro_templates.id"), nullable=True),
        sa.Column("ml_category_id", sa.String(100), nullable=True),
        sa.Column("ml_listado_url", sa.String(1000), nullable=True),
        sa.Column("top_n_scraping", sa.Integer, nullable=False, server_default="50"),
        sa.Column("filtro_vendidos_min", sa.Integer, nullable=True),
        sa.Column("retailers_activos", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("palabras_busqueda_usa", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("palabras_busqueda_traducciones", JSON, nullable=True),
        sa.Column("marcas_whitelist", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("blacklist_palabras", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("peso_min_kg", sa.Float, nullable=True),
        sa.Column("peso_max_kg", sa.Float, nullable=True),
        sa.Column("margen_minimo_verde", sa.Float, nullable=False, server_default="2.5"),
        sa.Column("margen_minimo_amarillo", sa.Float, nullable=False, server_default="1.8"),
        sa.Column("dias_rotacion_esperada", sa.Integer, nullable=True),
        sa.Column("outlets_activos", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("es_estacional", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("meses_alta_demanda", ARRAY(sa.Integer), nullable=False, server_default="{}"),
        sa.Column("activo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("prioridad", sa.String(20), nullable=False, server_default=sa.text("'media'")),
        sa.Column("frecuencia_scraping", sa.String(20), nullable=False, server_default=sa.text("'diaria'")),
        sa.Column("flag_restriccion", sa.String(100), nullable=True),
        sa.Column("notas_internas", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_retailers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("tipo", sa.String(20), nullable=False, server_default=sa.text("'online'")),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column("search_url_template", sa.String(1000), nullable=False),
        sa.Column("scraper_implementacion", sa.String(100), nullable=False, server_default=sa.text("''")),
        sa.Column("requiere_auth", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("cobra_tax_fl", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("envio_gratis_umbral", sa.Float, nullable=True),
        sa.Column("delay_min_ms", sa.Integer, nullable=False, server_default="2000"),
        sa.Column("delay_max_ms", sa.Integer, nullable=False, server_default="5000"),
        sa.Column("requiere_stealth", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("activo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("pausado_hasta", sa.DateTime, nullable=True),
        sa.Column("ultimo_error", sa.Text, nullable=True),
        sa.Column("veces_usado", sa.Integer, nullable=False, server_default="0"),
        sa.Column("productos_comprados_total", sa.Integer, nullable=False, server_default="0"),
        sa.Column("margen_real_promedio", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_outlets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False, unique=True),
        sa.Column("tipo", sa.String(20), nullable=False, server_default=sa.text("'tienda'")),
        sa.Column("ciudad", sa.String(100), nullable=False),
        sa.Column("estado", sa.String(100), nullable=False),
        sa.Column("direccion", sa.String(500), nullable=True),
        sa.Column("rubros_tipicos", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("activo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("fee_agencia_usd", sa.Float, nullable=False, server_default="50"),
        sa.Column("visitas_pasadas", sa.Integer, nullable=False, server_default="0"),
        sa.Column("efectividad_historica", sa.Float, nullable=True),
        sa.Column("notas_internas", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_productos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nombre", sa.String(500), nullable=False),
        sa.Column("marca", sa.String(100), nullable=True),
        sa.Column("modelo", sa.String(200), nullable=True),
        sa.Column("rubro_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.import_rubros.id"), nullable=False),
        sa.Column("imagen_url", sa.String(1000), nullable=True),
        sa.Column("ml_url", sa.String(1000), nullable=True),
        sa.Column("ml_precio_ars", sa.Float, nullable=True),
        sa.Column("ml_vendidos", sa.Integer, nullable=True),
        sa.Column("ml_posicion_ranking", sa.Integer, nullable=True),
        sa.Column("ml_total_competidores", sa.Integer, nullable=True),
        sa.Column("mejor_retailer_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.import_retailers.id"), nullable=True),
        sa.Column("mejor_precio_usd", sa.Float, nullable=True),
        sa.Column("mejor_precio_url", sa.String(1000), nullable=True),
        sa.Column("peso_kg", sa.Float, nullable=True),
        sa.Column("peso_source", sa.String(50), nullable=True),
        sa.Column("sales_tax_usd", sa.Float, nullable=True),
        sa.Column("costo_flete_usd", sa.Float, nullable=True),
        sa.Column("costo_puesto_usd", sa.Float, nullable=True),
        sa.Column("precio_venta_usd", sa.Float, nullable=True),
        sa.Column("ratio_margen", sa.Float, nullable=True),
        sa.Column("modo_caza", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("precio_objetivo_usd", sa.Float, nullable=True),
        sa.Column("cantidad_sugerida", sa.Integer, nullable=True),
        sa.Column("score_online", sa.Float, nullable=True),
        sa.Column("score_caza", sa.Float, nullable=True),
        sa.Column("semaforo", sa.String(10), nullable=True),
        sa.Column("flag_restriccion", sa.String(100), nullable=True),
        sa.Column("notas_manual", sa.Text, nullable=True),
        sa.Column("pinned", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("descartado", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("veces_importado", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_unidades_importadas", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_unidades_vendidas", sa.Integer, nullable=False, server_default="0"),
        sa.Column("dias_promedio_venta", sa.Float, nullable=True),
        sa.Column("margen_real_promedio", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_ofertas_retailer",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("producto_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.import_productos.id"), nullable=False),
        sa.Column("retailer_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.import_retailers.id"), nullable=False),
        sa.Column("precio_usd", sa.Float, nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("en_clearance", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("en_stock", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("envio_gratis", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("fecha", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_historico",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("producto_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.import_productos.id"), nullable=False),
        sa.Column("fecha", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("ml_precio_ars", sa.Float, nullable=True),
        sa.Column("ml_vendidos", sa.Integer, nullable=True),
        sa.Column("mejor_precio_usd", sa.Float, nullable=True),
        sa.Column("mejor_retailer_nombre", sa.String(200), nullable=True),
        sa.Column("cotizacion_mep", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_carritos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("estado", sa.String(30), nullable=False, server_default=sa.text("'borrador'")),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("cotizacion_mep_snapshot", sa.Float, nullable=True),
        sa.Column("fecha_cotizacion", sa.DateTime, nullable=True),
        sa.Column("fecha_compra", sa.DateTime, nullable=True),
        sa.Column("fecha_arribo", sa.DateTime, nullable=True),
        sa.Column("costo_total_real_usd", sa.Float, nullable=True),
        sa.Column("costo_flete_real_usd", sa.Float, nullable=True),
        sa.Column("fee_agencia_usd", sa.Float, nullable=True),
        sa.Column("peso_real_kg", sa.Float, nullable=True),
        sa.Column("es_plantilla", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_carrito_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("carrito_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.import_carritos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("producto_id", sa.String(36), sa.ForeignKey(f"{SCHEMA}.import_productos.id"), nullable=False),
        sa.Column("retailer_id", sa.String(36), nullable=True),
        sa.Column("precio_usd_locked", sa.Float, nullable=False),
        sa.Column("peso_kg_locked", sa.Float, nullable=False),
        sa.Column("cantidad", sa.Integer, nullable=False, server_default="1"),
        sa.Column("en_clearance_at_add", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("modo_compra", sa.String(20), nullable=False, server_default=sa.text("'online'")),
        sa.Column("outlet_esperado_id", sa.String(36), nullable=True),
        sa.Column("comprado", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("fecha_compra", sa.DateTime, nullable=True),
        sa.Column("precio_real_usd", sa.Float, nullable=True),
        sa.Column("unidades_recibidas", sa.Integer, nullable=False, server_default="0"),
        sa.Column("unidades_vendidas", sa.Integer, nullable=False, server_default="0"),
        sa.Column("fecha_primer_venta", sa.DateTime, nullable=True),
        sa.Column("fecha_ultima_venta", sa.DateTime, nullable=True),
        sa.Column("precio_venta_promedio_ars", sa.Float, nullable=True),
        sa.Column("margen_real_ratio", sa.Float, nullable=True),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_listas_caza",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("fecha", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("carrito_origen_id", sa.String(36), nullable=True),
        sa.Column("estado", sa.String(30), nullable=False, server_default=sa.text("'pendiente'")),
        sa.Column("productos", JSON, nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("total_estimado_usd", sa.Float, nullable=False, server_default="0"),
        sa.Column("outlets_recomendados_ids", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("fee_agencia_usd", sa.Float, nullable=True),
        sa.Column("notas_agencia", sa.Text, nullable=True),
        sa.Column("resultados_agencia", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_config",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("costo_flete_usd_por_kg", sa.Float, nullable=False, server_default="50"),
        sa.Column("sales_tax_fl", sa.Float, nullable=False, server_default="0.07"),
        sa.Column("margen_minimo_verde_global", sa.Float, nullable=False, server_default="2.5"),
        sa.Column("margen_minimo_amarillo_global", sa.Float, nullable=False, server_default="1.8"),
        sa.Column("fee_agencia_compra_fisica", sa.Float, nullable=False, server_default="50"),
        sa.Column("umbral_lista_caza_usd", sa.Float, nullable=False, server_default="500"),
        sa.Column("peso_minimo_envio", sa.Float, nullable=False, server_default="15"),
        sa.Column("peso_optimo_envio", sa.Float, nullable=False, server_default="40"),
        sa.Column("peso_maximo_envio", sa.Float, nullable=False, server_default="60"),
        sa.Column("capital_maximo_envio", sa.Float, nullable=False, server_default="5000"),
        sa.Column("ultima_actualizacion", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    op.create_table(
        "import_scrape_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("fecha", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("fuente", sa.String(200), nullable=False),
        sa.Column("productos_act", sa.Integer, nullable=False, server_default="0"),
        sa.Column("productos_nuevos", sa.Integer, nullable=False, server_default="0"),
        sa.Column("errores", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duracion_ms", sa.Integer, nullable=True),
        sa.Column("detalles", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    # Índices útiles
    op.create_index("ix_import_productos_rubro", "import_productos", ["rubro_id"], schema=SCHEMA)
    op.create_index("ix_import_productos_semaforo", "import_productos", ["semaforo"], schema=SCHEMA)
    op.create_index("ix_import_rubros_activo", "import_rubros", ["activo"], schema=SCHEMA)
    op.create_index("ix_import_retailers_slug", "import_retailers", ["slug"], schema=SCHEMA)
    op.create_index("ix_import_scrape_logs_fecha", "import_scrape_logs", ["fecha"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("import_scrape_logs", schema=SCHEMA)
    op.drop_table("import_config", schema=SCHEMA)
    op.drop_table("import_listas_caza", schema=SCHEMA)
    op.drop_table("import_carrito_items", schema=SCHEMA)
    op.drop_table("import_carritos", schema=SCHEMA)
    op.drop_table("import_historico", schema=SCHEMA)
    op.drop_table("import_ofertas_retailer", schema=SCHEMA)
    op.drop_table("import_productos", schema=SCHEMA)
    op.drop_table("import_outlets", schema=SCHEMA)
    op.drop_table("import_retailers", schema=SCHEMA)
    op.drop_table("import_rubros", schema=SCHEMA)
    op.drop_table("import_rubro_templates", schema=SCHEMA)
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA}")
