"""create codigos_amba table (rangos de CP que cuentan como zona AMBA)

Revision ID: 081
Revises: 080
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = '081'
down_revision = '080'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'codigos_amba',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('codigo_desde', sa.Integer(), nullable=False),
        sa.Column('codigo_hasta', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('codigos_amba')
