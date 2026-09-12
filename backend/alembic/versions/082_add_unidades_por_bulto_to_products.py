"""add unidades_por_bulto to products

Revision ID: 082
Revises: 081
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa

revision = '082'
down_revision = '081'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('unidades_por_bulto', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('products', 'unidades_por_bulto')
