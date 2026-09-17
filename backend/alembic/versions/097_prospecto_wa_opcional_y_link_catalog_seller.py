"""prospectos.whatsapp opcional; link vendedores -> catalog_sellers

Revision ID: 097
Revises: 096
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = '097'
down_revision = '096'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('prospectos', 'whatsapp', existing_type=sa.Text(), nullable=True)
    op.add_column(
        'vendedores',
        sa.Column('catalog_seller_id', sa.Integer(), sa.ForeignKey('catalog_sellers.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_vendedores_catalog_seller_id', 'vendedores', ['catalog_seller_id'])


def downgrade():
    op.drop_index('ix_vendedores_catalog_seller_id', table_name='vendedores')
    op.drop_column('vendedores', 'catalog_seller_id')
    op.alter_column('prospectos', 'whatsapp', existing_type=sa.Text(), nullable=False)
