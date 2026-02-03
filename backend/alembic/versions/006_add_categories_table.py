"""Add categories table and populate with existing categories

Revision ID: 006
Revises: 005
Create Date: 2026-02-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    # Create categories table
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_categories_name', 'categories', ['name'], unique=True)

    # Populate with existing categories from products
    op.execute("""
        INSERT INTO categories (name, is_active, display_order)
        SELECT DISTINCT category, true, 0
        FROM products
        WHERE category IS NOT NULL AND category != ''
        ORDER BY category
    """)


def downgrade():
    op.drop_index('ix_categories_name', table_name='categories')
    op.drop_table('categories')
