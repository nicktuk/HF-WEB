"""add rubro and rubros_interes to mayoristas

Revision ID: 083
Revises: 082
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '083'
down_revision = '082'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('mayoristas', sa.Column('rubro', sa.Text(), nullable=True))
    op.add_column('mayoristas', sa.Column('rubros_interes', postgresql.ARRAY(sa.Text()), nullable=True))


def downgrade():
    op.drop_column('mayoristas', 'rubros_interes')
    op.drop_column('mayoristas', 'rubro')
