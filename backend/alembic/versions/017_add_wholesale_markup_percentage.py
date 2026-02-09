"""
Add wholesale markup percentage to products.

Revision ID: 017
Revises: 016
Create Date: 2026-02-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "products",
        sa.Column("wholesale_markup_percentage", sa.Numeric(5, 2), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("products", "wholesale_markup_percentage")
