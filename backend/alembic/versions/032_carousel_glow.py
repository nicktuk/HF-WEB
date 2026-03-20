"""add carousel glow to categories

Revision ID: 032_carousel_glow
Revises: 031_carousel_filter_type
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa

revision = "032_carousel_glow"
down_revision = "031_carousel_filter_type"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("categories", sa.Column("carousel_glow", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("categories", sa.Column("carousel_glow_color", sa.String(7), nullable=True))

def downgrade() -> None:
    op.drop_column("categories", "carousel_glow_color")
    op.drop_column("categories", "carousel_glow")
