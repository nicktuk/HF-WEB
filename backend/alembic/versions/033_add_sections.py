"""add sections tables

Revision ID: 033_add_sections
Revises: 032_carousel_glow
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa

revision = "033_add_sections"
down_revision = "032_carousel_glow"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "sections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("subtitle", sa.String(200), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criteria_type", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("criteria_value", sa.String(100), nullable=True),
        sa.Column("max_products", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("bg_color", sa.String(7), nullable=True, server_default="#0D1B2A"),
        sa.Column("text_color", sa.String(7), nullable=True, server_default="#ffffff"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "section_products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

def downgrade() -> None:
    op.drop_table("section_products")
    op.drop_table("sections")
