"""add category mapping and category fk

Revision ID: 025_add_category_mapping_and_category_fk
Revises: 024
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "025_add_category_mapping_and_category_fk"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("category_id", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("source_category", sa.String(length=100), nullable=True))
    op.create_index(op.f("ix_products_category_id"), "products", ["category_id"], unique=False)
    op.create_index(op.f("ix_products_source_category"), "products", ["source_category"], unique=False)
    op.create_foreign_key(
        "fk_products_category_id_categories",
        "products",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "category_mappings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_name", sa.String(length=100), nullable=False),
        sa.Column("source_key", sa.String(length=100), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_key", name="uq_category_mappings_source_key"),
    )
    op.create_index(op.f("ix_category_mappings_id"), "category_mappings", ["id"], unique=False)
    op.create_index(op.f("ix_category_mappings_source_key"), "category_mappings", ["source_key"], unique=True)
    op.create_index(op.f("ix_category_mappings_category_id"), "category_mappings", ["category_id"], unique=False)

    # Backfill source_category from legacy products.category
    op.execute("UPDATE products SET source_category = category WHERE source_category IS NULL")

    # Backfill category_id by exact normalized (lower+trim) match against master categories
    op.execute(
        """
        UPDATE products p
        SET category_id = c.id
        FROM categories c
        WHERE p.category_id IS NULL
          AND p.source_category IS NOT NULL
          AND lower(trim(p.source_category)) = lower(trim(c.name))
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_category_mappings_category_id"), table_name="category_mappings")
    op.drop_index(op.f("ix_category_mappings_source_key"), table_name="category_mappings")
    op.drop_index(op.f("ix_category_mappings_id"), table_name="category_mappings")
    op.drop_table("category_mappings")

    op.drop_constraint("fk_products_category_id_categories", "products", type_="foreignkey")
    op.drop_index(op.f("ix_products_source_category"), table_name="products")
    op.drop_index(op.f("ix_products_category_id"), table_name="products")
    op.drop_column("products", "source_category")
    op.drop_column("products", "category_id")
