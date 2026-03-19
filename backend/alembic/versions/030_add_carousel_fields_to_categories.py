"""add carousel fields to categories

Revision ID: 030_add_carousel_fields_to_categories
Revises: 029_add_is_published_to_products
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "030_add_carousel_fields_to_categories"
down_revision = "029_add_is_published_to_products"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("show_in_carousel", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("categories", sa.Column("carousel_title", sa.String(100), nullable=True))
    op.add_column("categories", sa.Column("carousel_subtitle", sa.String(200), nullable=True))
    op.add_column("categories", sa.Column("carousel_image_url", sa.String(500), nullable=True))
    op.add_column("categories", sa.Column("carousel_bg_color", sa.String(7), nullable=True, server_default="#0D1B2A"))
    op.add_column("categories", sa.Column("carousel_text_color", sa.String(7), nullable=True, server_default="#ffffff"))
    op.add_column("categories", sa.Column("carousel_font", sa.String(50), nullable=True, server_default="sans"))


def downgrade() -> None:
    op.drop_column("categories", "carousel_font")
    op.drop_column("categories", "carousel_text_color")
    op.drop_column("categories", "carousel_bg_color")
    op.drop_column("categories", "carousel_image_url")
    op.drop_column("categories", "carousel_subtitle")
    op.drop_column("categories", "carousel_title")
    op.drop_column("categories", "show_in_carousel")
