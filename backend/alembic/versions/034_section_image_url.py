"""add image_url to sections

Revision ID: 034_section_image_url
Revises: 033_add_sections
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa

revision = "034_section_image_url"
down_revision = "033_add_sections"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("sections", sa.Column("image_url", sa.String(500), nullable=True))

def downgrade() -> None:
    op.drop_column("sections", "image_url")
