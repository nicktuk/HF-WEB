"""add modo_precio to configuracion_mayorista and comercio_descuento_tramos table

Revision ID: 085
Revises: 084
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = '085'
down_revision = '084'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'configuracion_mayorista',
        sa.Column('modo_precio', sa.String(length=10), nullable=False, server_default='markup'),
    )
    op.create_table(
        'comercio_descuento_tramos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('cantidad_minima', sa.Integer(), nullable=False),
        sa.Column('descuento_porcentaje', sa.Numeric(5, 2), nullable=False),
        sa.UniqueConstraint('cantidad_minima', name='uq_comercio_descuento_tramos_cantidad'),
    )


def downgrade():
    op.drop_table('comercio_descuento_tramos')
    op.drop_column('configuracion_mayorista', 'modo_precio')
