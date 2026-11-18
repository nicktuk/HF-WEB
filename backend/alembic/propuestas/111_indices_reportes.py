"""PROPUESTA (no aplicada): índice para los reportes de ventas.

Este archivo está FUERA de alembic/versions a propósito: el build de Railway
corre `alembic upgrade head` y no queremos aplicarlo sin revisión.
Para aplicarlo: moverlo a alembic/versions/ (ajustando down_revision a la
última migración vigente) y deployar.

Solo agrega un índice (no destructivo). Los demás accesos de los reportes ya
tienen índice: sale_items(product_id), sale_items(sale_id),
stock_purchases(product_id, purchase_date), product_deposit_stock(product_id),
product_color_stock(product_id).

Revision ID: 111
Revises: 110
"""
from alembic import op

revision = '111'
down_revision = '110'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Todas las consultas de reportes filtran por canal y rango de created_at.
    op.create_index(
        'ix_sales_origen_created_at', 'sales', ['origen', 'created_at'],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index('ix_sales_origen_created_at', table_name='sales', if_exists=True)
