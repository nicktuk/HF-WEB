"""add video_url to products

Revision ID: 043
Revises: 042
Create Date: 2026-05-02

"""
from alembic import op
import sqlalchemy as sa

revision = '043'
down_revision = '042'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('video_url', sa.Text(), nullable=True, comment='URL del video del producto'))


def downgrade() -> None:
    op.drop_column('products', 'video_url')
