"""add carousel_filter_type to categories

Revision ID: 031_carousel_filter_type
Revises: 030_carousel_categories
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa

revision = "031_carousel_filter_type"
down_revision = "030_carousel_categories"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("categories", sa.Column("carousel_filter_type", sa.String(50), nullable=True))

def downgrade() -> None:
    op.drop_column("categories", "carousel_filter_type")
