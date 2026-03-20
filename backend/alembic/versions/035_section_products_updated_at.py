"""add updated_at to section_products

Revision ID: 035_sp_updated_at
Revises: 034_section_image_url
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "035_sp_updated_at"
down_revision = "034_section_image_url"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column(
        "section_products",
        sa.Column("updated_at", sa.DateTime(), nullable=True)
    )

def downgrade() -> None:
    op.drop_column("section_products", "updated_at")
