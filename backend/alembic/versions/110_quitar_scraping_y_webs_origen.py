"""quitar scraping, webs de origen, precios de mercado e Import Scorer

- products: se borran source_website_id (FK a source_websites), source_url,
  source_category, pending_original_price, pending_price_detected_at,
  last_scraped_at, scrape_error_count y scrape_last_error.
- El slug pasa a ser único global (antes era único por web de origen). Si hay
  slugs repetidos entre webs, a los duplicados (todos menos el de menor id) se
  les agrega "-<id>" para que no choquen.
- Se borran las tablas source_websites, category_mappings, price_sources,
  market_prices y market_price_stats.
- Se borra el schema import_scorer completo (Import Scorer).

El downgrade recrea la estructura pero NO los datos: todos los productos
quedan asignados a una web de origen "manual".

Revision ID: 110
Revises: 109
Create Date: 2026-10-05
"""
import importlib.util
from pathlib import Path

from alembic import op
import sqlalchemy as sa


revision = '110'
down_revision = '109'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Slugs repetidos entre webs de origen: desambiguar antes del índice único.
    op.execute("""
        UPDATE products p
        SET slug = p.slug || '-' || p.id
        FROM (
            SELECT id, row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
            FROM products
        ) d
        WHERE d.id = p.id AND d.rn > 1
    """)

    op.drop_index('ix_products_source_slug', table_name='products')
    op.execute("DROP INDEX IF EXISTS ix_products_slug")
    op.create_index('ix_products_slug', 'products', ['slug'], unique=True)

    op.execute("DROP INDEX IF EXISTS ix_products_source_category")
    for col in (
        'source_website_id',
        'source_url',
        'source_category',
        'pending_original_price',
        'pending_price_detected_at',
        'last_scraped_at',
        'scrape_error_count',
        'scrape_last_error',
    ):
        op.drop_column('products', col)

    op.drop_table('market_price_stats')
    op.drop_table('market_prices')
    op.drop_table('price_sources')
    op.drop_table('category_mappings')
    op.drop_table('source_websites')

    op.execute("DROP SCHEMA IF EXISTS import_scorer CASCADE")


def _run_upgrade_of(filename: str) -> None:
    """Ejecuta el upgrade() de una migración vieja (para recrear el Import Scorer)."""
    path = Path(__file__).with_name(filename)
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.upgrade()


def downgrade() -> None:
    _run_upgrade_of('047_import_scorer_schema.py')
    _run_upgrade_of('048_import_trend_snapshots.py')

    op.create_table(
        'source_websites',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), unique=True, nullable=False, index=True),
        sa.Column('display_name', sa.String(200), nullable=False),
        sa.Column('base_url', sa.String(500), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('scraper_config', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.execute("""
        INSERT INTO source_websites (name, display_name, base_url, is_active, scraper_config, notes)
        VALUES ('manual', 'Producto Manual', '', true, '{}', 'Productos creados manualmente sin scraping.')
    """)

    op.add_column('products', sa.Column('source_website_id', sa.Integer(), nullable=True))
    op.execute("UPDATE products SET source_website_id = (SELECT id FROM source_websites WHERE name = 'manual')")
    op.alter_column('products', 'source_website_id', nullable=False)
    op.create_foreign_key(
        'products_source_website_id_fkey', 'products', 'source_websites',
        ['source_website_id'], ['id'],
    )
    op.add_column('products', sa.Column('source_url', sa.String(1000), nullable=True))
    op.add_column('products', sa.Column('source_category', sa.String(100), nullable=True))
    op.create_index('ix_products_source_category', 'products', ['source_category'])
    op.add_column('products', sa.Column('pending_original_price', sa.Numeric(10, 2), nullable=True))
    op.add_column('products', sa.Column('pending_price_detected_at', sa.DateTime(), nullable=True))
    op.add_column('products', sa.Column('last_scraped_at', sa.DateTime(), nullable=True))
    op.add_column('products', sa.Column('scrape_error_count', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('scrape_last_error', sa.Text(), nullable=True))

    op.drop_index('ix_products_slug', table_name='products')
    op.create_index('ix_products_source_slug', 'products', ['source_website_id', 'slug'], unique=True)

    op.create_table(
        'category_mappings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('source_name', sa.String(length=100), nullable=False),
        sa.Column('source_key', sa.String(length=100), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_key', name='uq_category_mappings_source_key'),
    )
    op.create_index('ix_category_mappings_id', 'category_mappings', ['id'])
    op.create_index('ix_category_mappings_source_key', 'category_mappings', ['source_key'], unique=True)
    op.create_index('ix_category_mappings_category_id', 'category_mappings', ['category_id'])

    op.create_table(
        'price_sources',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), unique=True, nullable=False, index=True),
        sa.Column('display_name', sa.String(200), nullable=False),
        sa.Column('base_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('scraper_config', sa.JSON(), nullable=True),
        sa.Column('rate_limit_per_minute', sa.Integer(), default=30),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'market_prices',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source_id', sa.Integer(), sa.ForeignKey('price_sources.id'), nullable=False),
        sa.Column('external_id', sa.String(255), nullable=True),
        sa.Column('external_url', sa.Text(), nullable=True),
        sa.Column('external_title', sa.String(500), nullable=True),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(3), default='ARS'),
        sa.Column('shipping_cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('seller_name', sa.String(255), nullable=True),
        sa.Column('seller_reputation', sa.String(50), nullable=True),
        sa.Column('stock_status', sa.String(50), nullable=True),
        sa.Column('match_confidence', sa.Numeric(3, 2), nullable=False),
        sa.Column('match_method', sa.String(50), nullable=True),
        sa.Column('is_valid', sa.Boolean(), default=True, nullable=False),
        sa.Column('scraped_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_market_prices_product_source', 'market_prices', ['product_id', 'source_id'])
    op.create_index('ix_market_prices_valid_recent', 'market_prices', ['product_id', 'is_valid', 'scraped_at'])
    op.create_table(
        'market_price_stats',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('avg_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('min_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('max_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('median_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('sample_count', sa.Integer(), default=0),
        sa.Column('outlier_count', sa.Integer(), default=0),
        sa.Column('sources_count', sa.Integer(), default=0),
        sa.Column('breakdown_by_source', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
