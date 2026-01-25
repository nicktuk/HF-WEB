"""Initial migration - Create all tables

Revision ID: 001
Revises:
Create Date: 2026-01-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Source Websites table
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
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Products table
    op.create_table(
        'products',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('source_website_id', sa.Integer(), sa.ForeignKey('source_websites.id'), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False, index=True),
        sa.Column('source_url', sa.String(1000), nullable=True),
        sa.Column('original_name', sa.String(500), nullable=False),
        sa.Column('original_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('original_currency', sa.String(3), default='ARS'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('short_description', sa.String(1000), nullable=True),
        sa.Column('brand', sa.String(100), nullable=True),
        sa.Column('sku', sa.String(100), nullable=True),
        sa.Column('enabled', sa.Boolean(), default=False, nullable=False, index=True),
        sa.Column('markup_percentage', sa.Numeric(5, 2), default=0, nullable=False),
        sa.Column('custom_name', sa.String(500), nullable=True),
        sa.Column('custom_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('display_order', sa.Integer(), default=0, nullable=False),
        sa.Column('category', sa.String(100), nullable=True, index=True),
        sa.Column('last_scraped_at', sa.DateTime(), nullable=True),
        sa.Column('scrape_error_count', sa.Integer(), default=0),
        sa.Column('scrape_last_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Unique constraint on source_website_id + slug
    op.create_index(
        'ix_products_source_slug',
        'products',
        ['source_website_id', 'slug'],
        unique=True
    )

    # Index for enabled products ordering
    op.create_index(
        'ix_products_enabled_order',
        'products',
        ['enabled', 'display_order']
    )

    # Product Images table
    op.create_table(
        'product_images',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('original_url', sa.Text(), nullable=True),
        sa.Column('alt_text', sa.String(500), nullable=True),
        sa.Column('display_order', sa.Integer(), default=0),
        sa.Column('is_primary', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_index(
        'ix_product_images_product',
        'product_images',
        ['product_id', 'display_order']
    )

    # Price Sources table (MercadoLibre, Google Shopping, etc.)
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
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Market Prices table
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
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_index(
        'ix_market_prices_product_source',
        'market_prices',
        ['product_id', 'source_id']
    )

    op.create_index(
        'ix_market_prices_valid_recent',
        'market_prices',
        ['product_id', 'is_valid', 'scraped_at']
    )

    # Market Price Stats table (aggregated statistics)
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
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('market_price_stats')
    op.drop_table('market_prices')
    op.drop_table('price_sources')
    op.drop_table('product_images')
    op.drop_table('products')
    op.drop_table('source_websites')
