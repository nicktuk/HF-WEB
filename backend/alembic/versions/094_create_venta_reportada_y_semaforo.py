"""create venta_reportada table; add configurable semaforo thresholds
to configuracion_mayorista

Revision ID: 094
Revises: 093
Create Date: 2026-09-17
"""
from alembic import op
import sqlalchemy as sa

revision = '094'
down_revision = '093'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'configuracion_mayorista',
        sa.Column('semaforo_dias_amarillo', sa.Integer(), nullable=False, server_default='7'),
    )
    op.add_column(
        'configuracion_mayorista',
        sa.Column('semaforo_dias_rojo', sa.Integer(), nullable=False, server_default='14'),
    )

    op.execute("""
        CREATE TABLE venta_reportada (
            id                          SERIAL PRIMARY KEY,
            comercio_id                 INTEGER NOT NULL REFERENCES mayoristas(id) ON DELETE CASCADE,
            producto_id                 INTEGER REFERENCES products(id) ON DELETE SET NULL,
            unidades_vendidas_desde_ultima INTEGER NOT NULL,
            fecha                       DATE NOT NULL,
            created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at                  TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_venta_reportada_comercio_id ON venta_reportada (comercio_id)")
    op.execute("CREATE INDEX ix_venta_reportada_producto_id ON venta_reportada (producto_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS venta_reportada")
    op.drop_column('configuracion_mayorista', 'semaforo_dias_rojo')
    op.drop_column('configuracion_mayorista', 'semaforo_dias_amarillo')
