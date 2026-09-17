"""tasas de comisión configurables (mayorista/minorista) + comisión sobre venta minorista

Revision ID: 098
Revises: 097
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = '098'
down_revision = '097'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'configuracion_mayorista',
        sa.Column('comision_mayorista_nuevo_porcentaje', sa.Numeric(5, 2), nullable=False, server_default='15'),
    )
    op.add_column(
        'configuracion_mayorista',
        sa.Column('comision_mayorista_recompra_porcentaje', sa.Numeric(5, 2), nullable=False, server_default='10'),
    )
    op.add_column(
        'configuracion_mayorista',
        sa.Column('comision_minorista_porcentaje', sa.Numeric(5, 2), nullable=False, server_default='0'),
    )

    # pedido_id deja de ser obligatorio: una comisión ahora puede venir de un
    # pedido mayorista (pedido_id) o de una venta minorista (sale_id nuevo),
    # nunca de los dos. La regla "exactamente uno de los dos" se valida en
    # Python (services/comercio_pedidos.py), no acá.
    op.alter_column('comisiones', 'pedido_id', existing_type=sa.Integer(), nullable=True)
    op.add_column(
        'comisiones',
        sa.Column('sale_id', sa.Integer(), sa.ForeignKey('sales.id', ondelete='CASCADE'), nullable=True),
    )
    op.create_index('ix_comisiones_sale_id', 'comisiones', ['sale_id'], unique=True)


def downgrade():
    op.drop_index('ix_comisiones_sale_id', table_name='comisiones')
    op.drop_column('comisiones', 'sale_id')
    op.alter_column('comisiones', 'pedido_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('configuracion_mayorista', 'comision_minorista_porcentaje')
    op.drop_column('configuracion_mayorista', 'comision_mayorista_recompra_porcentaje')
    op.drop_column('configuracion_mayorista', 'comision_mayorista_nuevo_porcentaje')
