"""create mayoristas table

Revision ID: 063
Revises: 062
Create Date: 2026-06-12
"""
from alembic import op

revision = '063'
down_revision = '062'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE TYPE estado_mayorista_enum AS ENUM "
        "('pendiente', 'activo', 'rechazado', 'suspendido')"
    )
    op.execute("""
        CREATE TABLE mayoristas (
            id               SERIAL PRIMARY KEY,
            nombre           TEXT NOT NULL,
            apellido         TEXT NOT NULL,
            usuario          TEXT NOT NULL,
            password_hash    TEXT NOT NULL,
            celular          TEXT,
            email            TEXT,
            nombre_local     TEXT NOT NULL,
            ubicacion_local  TEXT NOT NULL,
            estado           estado_mayorista_enum NOT NULL DEFAULT 'pendiente',
            vendedor_id      INTEGER REFERENCES vendedores(id) ON DELETE SET NULL,
            activado_at      TIMESTAMP,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_mayoristas_usuario UNIQUE (usuario)
        )
    """)
    op.execute("CREATE INDEX ix_mayoristas_estado ON mayoristas (estado)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS mayoristas")
    op.execute("DROP TYPE IF EXISTS estado_mayorista_enum")
