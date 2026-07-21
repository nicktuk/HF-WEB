"""replace hardcoded seller/payer strings with FK to catalog_sellers

Revision ID: 074
Revises: 073
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = '074'
down_revision = '073'
branch_labels = None
depends_on = None


def upgrade():
    # sales
    op.add_column('sales', sa.Column('seller_id', sa.Integer(), sa.ForeignKey('catalog_sellers.id'), nullable=True))
    op.execute("""
        UPDATE sales s SET seller_id = cs.id
        FROM catalog_sellers cs
        WHERE cs.nombre = s.seller
    """)
    op.alter_column('sales', 'seller_id', nullable=False)
    op.drop_column('sales', 'seller')

    # orders
    op.add_column('orders', sa.Column('seller_id', sa.Integer(), sa.ForeignKey('catalog_sellers.id'), nullable=True))
    op.execute("""
        UPDATE orders o SET seller_id = cs.id
        FROM catalog_sellers cs
        WHERE cs.nombre = o.seller
    """)
    op.alter_column('orders', 'seller_id', nullable=False)
    op.drop_column('orders', 'seller')

    # deposits (nullable, igual que antes)
    op.add_column('deposits', sa.Column('seller_id', sa.Integer(), sa.ForeignKey('catalog_sellers.id'), nullable=True))
    op.execute("""
        UPDATE deposits d SET seller_id = cs.id
        FROM catalog_sellers cs
        WHERE cs.nombre = d.seller
    """)
    op.drop_column('deposits', 'seller')

    # purchase_payments
    op.add_column('purchase_payments', sa.Column('payer_id', sa.Integer(), sa.ForeignKey('catalog_sellers.id'), nullable=True))
    op.execute("""
        UPDATE purchase_payments p SET payer_id = cs.id
        FROM catalog_sellers cs
        WHERE cs.nombre = p.payer
    """)
    op.alter_column('purchase_payments', 'payer_id', nullable=False)
    op.drop_column('purchase_payments', 'payer')


def downgrade():
    op.add_column('purchase_payments', sa.Column('payer', sa.String(length=20), nullable=True))
    op.execute("""
        UPDATE purchase_payments p SET payer = cs.nombre
        FROM catalog_sellers cs
        WHERE cs.id = p.payer_id
    """)
    op.alter_column('purchase_payments', 'payer', nullable=False)
    op.drop_column('purchase_payments', 'payer_id')

    op.add_column('deposits', sa.Column('seller', sa.String(length=50), nullable=True))
    op.execute("""
        UPDATE deposits d SET seller = cs.nombre
        FROM catalog_sellers cs
        WHERE cs.id = d.seller_id
    """)
    op.drop_column('deposits', 'seller_id')

    op.add_column('orders', sa.Column('seller', sa.String(length=20), nullable=True))
    op.execute("""
        UPDATE orders o SET seller = cs.nombre
        FROM catalog_sellers cs
        WHERE cs.id = o.seller_id
    """)
    op.alter_column('orders', 'seller', nullable=False)
    op.drop_column('orders', 'seller_id')

    op.add_column('sales', sa.Column('seller', sa.String(length=20), nullable=True))
    op.execute("""
        UPDATE sales s SET seller = cs.nombre
        FROM catalog_sellers cs
        WHERE cs.id = s.seller_id
    """)
    op.alter_column('sales', 'seller', nullable=False)
    op.drop_column('sales', 'seller_id')
