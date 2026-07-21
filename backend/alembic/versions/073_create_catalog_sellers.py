"""create catalog_sellers table + seed Facu/Heber/Web

Revision ID: 073
Revises: 072
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = '073'
down_revision = '072'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'catalog_sellers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('nombre', sa.String(length=50), nullable=False, unique=True),
        sa.Column('celular', sa.String(length=50), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )

    catalog_sellers = sa.table(
        'catalog_sellers',
        sa.column('nombre', sa.String),
        sa.column('activo', sa.Boolean),
    )
    op.bulk_insert(catalog_sellers, [
        {'nombre': 'Facu', 'activo': True},
        {'nombre': 'Heber', 'activo': True},
        {'nombre': 'Web', 'activo': False},
    ])


def downgrade():
    op.drop_table('catalog_sellers')
