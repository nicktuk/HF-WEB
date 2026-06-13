"""create mayoristas table

Revision ID: 063
Revises: 062
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = '063'
down_revision = '062'
branch_labels = None
depends_on = None

estado_mayorista_enum = sa.Enum(
    'pendiente', 'activo', 'rechazado', 'suspendido',
    name='estado_mayorista_enum',
)


def upgrade():
    estado_mayorista_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        'mayoristas',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('nombre', sa.Text(), nullable=False),
        sa.Column('apellido', sa.Text(), nullable=False),
        sa.Column('usuario', sa.Text(), nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('celular', sa.Text(), nullable=True),
        sa.Column('email', sa.Text(), nullable=True),
        sa.Column('nombre_local', sa.Text(), nullable=False),
        sa.Column('ubicacion_local', sa.Text(), nullable=False),
        sa.Column('estado', estado_mayorista_enum, nullable=False, server_default='pendiente'),
        sa.Column('vendedor_id', sa.Integer(), sa.ForeignKey('vendedores.id', ondelete='SET NULL'), nullable=True),
        sa.Column('activado_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('usuario', name='uq_mayoristas_usuario'),
    )
    op.create_index('ix_mayoristas_estado', 'mayoristas', ['estado'])


def downgrade():
    op.drop_index('ix_mayoristas_estado', 'mayoristas')
    op.drop_table('mayoristas')
    estado_mayorista_enum.drop(op.get_bind(), checkfirst=True)
