"""precio de oferta con fecha de fin opcional en products

Agrega sale_price (precio de oferta minorista) y sale_price_ends_at
(vigencia opcional; si es NULL la oferta no vence). Ambos nullable.

Revision ID: 103
Revises: 102
Create Date: 2026-09-21
"""
from alembic import op
import sqlalchemy as sa

revision = '103'
down_revision = '102'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('sale_price', sa.Numeric(10, 2), nullable=True))
    op.add_column('products', sa.Column('sale_price_ends_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('products', 'sale_price_ends_at')
    op.drop_column('products', 'sale_price')
