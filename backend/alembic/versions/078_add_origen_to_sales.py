"""add origen (canal) to sales

Revision ID: 078
Revises: 077
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = '078'
down_revision = '077'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sales', sa.Column('origen', sa.String(length=20), nullable=False, server_default='admin'))
    op.execute("""
        UPDATE sales s SET origen = 'web'
        FROM catalog_sellers cs
        WHERE cs.id = s.seller_id AND cs.nombre = 'Web'
    """)


def downgrade():
    op.drop_column('sales', 'origen')
