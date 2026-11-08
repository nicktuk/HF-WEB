"""Add always_visible to categories

Categorías marcadas como "siempre visible" se muestran en la fila fija del
menú público (junto a Nuevos ingresos / Ofertas), sin importar el estilo de
navegación ni la categoría seleccionada.

Revision ID: 110
Revises: 109
Create Date: 2026-11-08
"""
from alembic import op
import sqlalchemy as sa

revision = '110'
down_revision = '109'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'categories',
        sa.Column('always_visible', sa.Boolean(), nullable=False, server_default=sa.false())
    )


def downgrade():
    op.drop_column('categories', 'always_visible')
