"""create bot_sesiones table (estado conversacional del bot de WhatsApp, leído/escrito por n8n)

Revision ID: 077
Revises: 076
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '077'
down_revision = '076'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'bot_sesiones',
        sa.Column('celular', sa.String(length=20), primary_key=True),
        sa.Column('paso', sa.String(length=30), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('bot_sesiones')
