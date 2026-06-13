"""create pedidos_mayoristas and pedidos_mayoristas_items tables

Revision ID: 066
Revises: 065
Create Date: 2026-06-12
"""
from alembic import op

revision = '066'
down_revision = '065'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE TYPE estado_pedido_mayorista_enum AS ENUM "
        "('recibido', 'confirmado', 'preparando', 'entregado', 'cancelado')"
    )
    op.execute("""
        CREATE TABLE pedidos_mayoristas (
            id                  SERIAL PRIMARY KEY,
            mayorista_id        INTEGER NOT NULL REFERENCES mayoristas(id) ON DELETE RESTRICT,
            vendedor_nombre     TEXT,
            vendedor_celular_wa TEXT,
            estado              estado_pedido_mayorista_enum NOT NULL DEFAULT 'recibido',
            total               NUMERIC(12,2) NOT NULL DEFAULT 0,
            notas               TEXT,
            modificado_at       TIMESTAMP,
            modificado_por      TEXT,
            created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_pedidos_mayoristas_mayorista_id ON pedidos_mayoristas (mayorista_id)")
    op.execute("CREATE INDEX ix_pedidos_mayoristas_estado ON pedidos_mayoristas (estado)")
    op.execute("CREATE INDEX ix_pedidos_mayoristas_created_at ON pedidos_mayoristas (created_at)")

    op.execute("""
        CREATE TABLE pedidos_mayoristas_items (
            id               SERIAL PRIMARY KEY,
            pedido_id        INTEGER NOT NULL REFERENCES pedidos_mayoristas(id) ON DELETE CASCADE,
            producto_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,
            nombre_producto  TEXT NOT NULL,
            cantidad         INTEGER NOT NULL,
            precio_unitario  NUMERIC(12,2) NOT NULL,
            precio_original  NUMERIC(12,2),
            subtotal         NUMERIC(12,2) NOT NULL,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_pedidos_mayoristas_items_pedido_id ON pedidos_mayoristas_items (pedido_id)")
    op.execute("CREATE INDEX ix_pedidos_mayoristas_items_producto_id ON pedidos_mayoristas_items (producto_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS pedidos_mayoristas_items")
    op.execute("DROP TABLE IF EXISTS pedidos_mayoristas")
    op.execute("DROP TYPE IF EXISTS estado_pedido_mayorista_enum")
