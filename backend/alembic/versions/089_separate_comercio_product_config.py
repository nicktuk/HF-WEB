"""separate comercio-specific product config into its own tables

Revision ID: 089
Revises: 088
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = '089'
down_revision = '088'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'product_comercio_config',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('es_mayorista', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('precio_mayorista_override', sa.Numeric(12, 2), nullable=True),
        sa.Column('unidades_por_bulto', sa.Integer(), nullable=True),
        sa.Column('cantidad_minima', sa.Integer(), nullable=True),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('product_id', name='uq_product_comercio_config_product'),
    )
    op.create_index('ix_product_comercio_config_es_mayorista', 'product_comercio_config', ['es_mayorista'])

    op.create_table(
        'product_comercio_images',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('alt_text', sa.String(length=500), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_product_comercio_images_product_id', 'product_comercio_images', ['product_id'])

    # Migra los datos existentes de products a la tabla nueva (solo donde había algo cargado).
    op.execute("""
        INSERT INTO product_comercio_config
            (product_id, es_mayorista, precio_mayorista_override, unidades_por_bulto, cantidad_minima, created_at, updated_at)
        SELECT id, es_mayorista, precio_mayorista_override, unidades_por_bulto, cantidad_minima, NOW(), NOW()
        FROM products
        WHERE es_mayorista = true
           OR precio_mayorista_override IS NOT NULL
           OR unidades_por_bulto IS NOT NULL
           OR cantidad_minima IS NOT NULL
    """)

    op.drop_index('ix_products_es_mayorista', table_name='products')
    op.drop_column('products', 'es_mayorista')
    op.drop_column('products', 'precio_mayorista_override')
    op.drop_column('products', 'unidades_por_bulto')
    op.drop_column('products', 'cantidad_minima')


def downgrade():
    op.add_column('products', sa.Column('es_mayorista', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('products', sa.Column('precio_mayorista_override', sa.Numeric(12, 2), nullable=True))
    op.add_column('products', sa.Column('unidades_por_bulto', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('cantidad_minima', sa.Integer(), nullable=True))
    op.create_index('ix_products_es_mayorista', 'products', ['es_mayorista'])

    op.execute("""
        UPDATE products p
        SET es_mayorista = c.es_mayorista,
            precio_mayorista_override = c.precio_mayorista_override,
            unidades_por_bulto = c.unidades_por_bulto,
            cantidad_minima = c.cantidad_minima
        FROM product_comercio_config c
        WHERE c.product_id = p.id
    """)

    op.drop_table('product_comercio_images')
    op.drop_table('product_comercio_config')
