"""create comision table

Revision ID: 092
Revises: 091
Create Date: 2026-09-17
"""
from alembic import op

revision = '092'
down_revision = '091'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE TYPE estado_comision_enum AS ENUM ('pendiente', 'liquidada')"
    )
    op.execute("""
        CREATE TABLE comisiones (
            id           SERIAL PRIMARY KEY,
            vendedor_id  INTEGER NOT NULL REFERENCES vendedores(id) ON DELETE RESTRICT,
            pedido_id    INTEGER NOT NULL REFERENCES pedidos_mayoristas(id) ON DELETE CASCADE,
            base         NUMERIC(12,2) NOT NULL,
            tasa         NUMERIC(5,4) NOT NULL,
            monto        NUMERIC(12,2) NOT NULL,
            estado       estado_comision_enum NOT NULL DEFAULT 'pendiente',
            created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE UNIQUE INDEX ix_comisiones_pedido_id ON comisiones (pedido_id)")
    op.execute("CREATE INDEX ix_comisiones_vendedor_id ON comisiones (vendedor_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS comisiones")
    op.execute("DROP TYPE IF EXISTS estado_comision_enum")
