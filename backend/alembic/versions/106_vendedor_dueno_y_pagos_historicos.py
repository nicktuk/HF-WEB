"""vendedores dueños (no cobran comisión) y liquidaciones históricas

- catalog_sellers.es_dueno: el vendedor es dueño del negocio y no cobra
  comisión — no se le generan comisiones (lo que "ganaría" queda como margen).
- liquidaciones_comision.historica: la liquidación registra un pago hecho
  antes de existir las liquidaciones semanales (sin gasto asociado). Se
  marcan también las históricas que armó la migración 105.

Revision ID: 106
Revises: 105
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa

revision = '106'
down_revision = '105'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'catalog_sellers',
        sa.Column('es_dueno', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'liquidaciones_comision',
        sa.Column('historica', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE liquidaciones_comision SET historica = true WHERE notas LIKE 'Histórica:%'")


def downgrade():
    op.drop_column('liquidaciones_comision', 'historica')
    op.drop_column('catalog_sellers', 'es_dueno')
