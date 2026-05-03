"""add color to product_images

Revision ID: 044
Revises: 043
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa

revision = '044'
down_revision = '043'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('product_images', sa.Column('color', sa.String(20), nullable=True, comment='Color hex asociado a la imagen'))


def downgrade() -> None:
    op.drop_column('product_images', 'color')
