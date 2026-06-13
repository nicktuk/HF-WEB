"""create pedidos_mayoristas and pedidos_mayoristas_items tables

Revision ID: 066
Revises: 065
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = '066'
down_revision = '065'
branch_labels = None
depends_on = None

# create_type=False: el tipo se crea manualmente con SQL para evitar
# que op.create_table() intente crearlo por segunda vez y falle.
_estado_col = sa.Enum(
    'recibido', 'confirmado', 'preparando', 'entregado', 'cancelado',
    name='estado_pedido_mayorista_enum',
    create_type=False,
)


def upgrade():
    op.execute(
        "CREATE TYPE estado_pedido_mayorista_enum AS ENUM "
        "('recibido', 'confirmado', 'preparando', 'entregado', 'cancelado')"
    )
    op.create_table(
        'pedidos_mayoristas',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('mayorista_id', sa.Integer(), sa.ForeignKey('mayoristas.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('vendedor_nombre', sa.Text(), nullable=True),
        sa.Column('vendedor_celular_wa', sa.Text(), nullable=True),
        sa.Column('estado', _estado_col, nullable=False, server_default='recibido'),
        sa.Column('total', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('modificado_at', sa.DateTime(), nullable=True),
        sa.Column('modificado_por', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_pedidos_mayoristas_mayorista_id', 'pedidos_mayoristas', ['mayorista_id'])
    op.create_index('ix_pedidos_mayoristas_estado', 'pedidos_mayoristas', ['estado'])
    op.create_index('ix_pedidos_mayoristas_created_at', 'pedidos_mayoristas', ['created_at'])

    op.create_table(
        'pedidos_mayoristas_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('pedido_id', sa.Integer(), sa.ForeignKey('pedidos_mayoristas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('producto_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True),
        sa.Column('nombre_producto', sa.Text(), nullable=False),
        sa.Column('cantidad', sa.Integer(), nullable=False),
        sa.Column('precio_unitario', sa.Numeric(12, 2), nullable=False),
        sa.Column('precio_original', sa.Numeric(12, 2), nullable=True),
        sa.Column('subtotal', sa.Numeric(12, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_pedidos_mayoristas_items_pedido_id', 'pedidos_mayoristas_items', ['pedido_id'])
    op.create_index('ix_pedidos_mayoristas_items_producto_id', 'pedidos_mayoristas_items', ['producto_id'])


def downgrade():
    op.drop_index('ix_pedidos_mayoristas_items_producto_id', 'pedidos_mayoristas_items')
    op.drop_index('ix_pedidos_mayoristas_items_pedido_id', 'pedidos_mayoristas_items')
    op.drop_table('pedidos_mayoristas_items')
    op.drop_index('ix_pedidos_mayoristas_created_at', 'pedidos_mayoristas')
    op.drop_index('ix_pedidos_mayoristas_estado', 'pedidos_mayoristas')
    op.drop_index('ix_pedidos_mayoristas_mayorista_id', 'pedidos_mayoristas')
    op.drop_table('pedidos_mayoristas')
    op.execute("DROP TYPE IF EXISTS estado_pedido_mayorista_enum")
