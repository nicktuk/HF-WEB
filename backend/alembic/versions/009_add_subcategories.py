"""Add subcategories table and subcategory column to products

Revision ID: 009
Revises: 008
Create Date: 2026-02-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    # Create subcategories table
    op.create_table(
        'subcategories',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('color', sa.String(7), server_default='#6b7280', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )

    # Create indexes
    op.create_index('ix_subcategories_name', 'subcategories', ['name'])
    op.create_index('ix_subcategories_category_id', 'subcategories', ['category_id'])

    # Create unique constraint for name within category
    op.create_unique_constraint(
        'uq_subcategory_name_category',
        'subcategories',
        ['name', 'category_id']
    )

    # Add subcategory column to products
    op.add_column(
        'products',
        sa.Column('subcategory', sa.String(100), nullable=True)
    )

    # Create index on products.subcategory
    op.create_index('ix_products_subcategory', 'products', ['subcategory'])


def downgrade():
    # Drop index on products.subcategory
    op.drop_index('ix_products_subcategory', table_name='products')

    # Drop subcategory column from products
    op.drop_column('products', 'subcategory')

    # Drop unique constraint
    op.drop_constraint('uq_subcategory_name_category', 'subcategories', type_='unique')

    # Drop indexes
    op.drop_index('ix_subcategories_category_id', table_name='subcategories')
    op.drop_index('ix_subcategories_name', table_name='subcategories')

    # Drop subcategories table
    op.drop_table('subcategories')
