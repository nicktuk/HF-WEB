"""override manual de comisión (%/monto) en ventas y pedidos mayoristas

Permite cargar, al crear o editar una venta/pedido, un porcentaje o un
monto fijo de comisión que pisa la tasa configurada en el admin
(ConfiguracionComercio) para ese caso puntual. A lo sumo uno de los dos
se usa (si hay monto, gana; si no, se usa el porcentaje) — se valida en
Python (services/comisiones.py), no hay CHECK en DB.

Revision ID: 101
Revises: 100
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = '101'
down_revision = '100'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sales', sa.Column('comision_porcentaje_manual', sa.Numeric(5, 2), nullable=True))
    op.add_column('sales', sa.Column('comision_monto_manual', sa.Numeric(12, 2), nullable=True))
    op.add_column('pedidos_mayoristas', sa.Column('comision_porcentaje_manual', sa.Numeric(5, 2), nullable=True))
    op.add_column('pedidos_mayoristas', sa.Column('comision_monto_manual', sa.Numeric(12, 2), nullable=True))


def downgrade():
    op.drop_column('pedidos_mayoristas', 'comision_monto_manual')
    op.drop_column('pedidos_mayoristas', 'comision_porcentaje_manual')
    op.drop_column('sales', 'comision_monto_manual')
    op.drop_column('sales', 'comision_porcentaje_manual')
