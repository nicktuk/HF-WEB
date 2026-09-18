"""tasas de comisión propias por vendedor, con fallback al % general

Agrega a catalog_sellers los mismos 3 campos que ya existen en
configuracion_mayorista (comision_mayorista_nuevo/recompra_porcentaje,
comision_minorista_porcentaje), todos nullable: en null se sigue usando
el % general; cargados, pisan el general para ese vendedor puntual.

Revision ID: 102
Revises: 101
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = '102'
down_revision = '101'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('catalog_sellers', sa.Column('comision_mayorista_nuevo_porcentaje', sa.Numeric(5, 2), nullable=True))
    op.add_column('catalog_sellers', sa.Column('comision_mayorista_recompra_porcentaje', sa.Numeric(5, 2), nullable=True))
    op.add_column('catalog_sellers', sa.Column('comision_minorista_porcentaje', sa.Numeric(5, 2), nullable=True))


def downgrade():
    op.drop_column('catalog_sellers', 'comision_minorista_porcentaje')
    op.drop_column('catalog_sellers', 'comision_mayorista_recompra_porcentaje')
    op.drop_column('catalog_sellers', 'comision_mayorista_nuevo_porcentaje')
