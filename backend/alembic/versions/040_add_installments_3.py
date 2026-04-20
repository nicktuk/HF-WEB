"""Add installments_3 and custom_installment_price to products

Revision ID: 040
Revises: 039
Create Date: 2026-04-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '040'
down_revision = '039'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'products',
        sa.Column(
            'installments_3',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment='Pago en 3 cuotas sin interés habilitado',
        )
    )
    op.add_column(
        'products',
        sa.Column(
            'custom_installment_price',
            sa.Numeric(10, 2),
            nullable=True,
            comment='Precio fijo por cuota (si no se define, se calcula con markup)',
        )
    )
    op.create_index('ix_products_installments_3', 'products', ['installments_3'])


def downgrade():
    op.drop_index('ix_products_installments_3', table_name='products')
    op.drop_column('products', 'custom_installment_price')
    op.drop_column('products', 'installments_3')
