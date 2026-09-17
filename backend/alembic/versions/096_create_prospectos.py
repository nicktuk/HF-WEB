"""create prospectos table (cartera de prospección del vendedor)

Revision ID: 096
Revises: 095
Create Date: 2026-09-17
"""
from alembic import op
import sqlalchemy as sa

revision = '096'
down_revision = '095'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE prospectos (
            id                      SERIAL PRIMARY KEY,
            vendedor_id             INTEGER NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
            comercio_nombre         TEXT NOT NULL,
            whatsapp                TEXT NOT NULL,
            direccion               TEXT,
            estado                  TEXT NOT NULL DEFAULT 'interesado',
            fecha_proximo_contacto  DATE,
            notas                   TEXT,
            comercio_id             INTEGER REFERENCES mayoristas(id) ON DELETE SET NULL,
            created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_prospectos_vendedor_id ON prospectos (vendedor_id)")
    op.execute("CREATE INDEX ix_prospectos_estado ON prospectos (estado)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS prospectos")
