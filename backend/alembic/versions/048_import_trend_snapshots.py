"""import trend snapshots

Revision ID: 048
Revises: 047
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '048'
down_revision = '047'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'import_trend_snapshots',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('rubro_id', sa.String(), sa.ForeignKey('import_scorer.import_rubros.id', ondelete='CASCADE'), nullable=False),
        sa.Column('keyword', sa.String(), nullable=False),
        sa.Column('data_ar', sa.JSON(), nullable=True),
        sa.Column('data_usa', sa.JSON(), nullable=True),
        sa.Column('score_ar', sa.Float(), nullable=True, server_default='0'),
        sa.Column('score_usa', sa.Float(), nullable=True, server_default='0'),
        sa.Column('tendencia_ar', sa.String(), nullable=True, server_default=sa.text("'sin_datos'")),
        sa.Column('tendencia_usa', sa.String(), nullable=True, server_default=sa.text("'sin_datos'")),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('rubro_id'),
        schema='import_scorer',
    )


def downgrade():
    op.drop_table('import_trend_snapshots', schema='import_scorer')
