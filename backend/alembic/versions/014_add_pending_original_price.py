"""
Add pending original price fields.

Revision ID: 014
Revises: 013
Create Date: 2026-02-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "products",
        sa.Column("pending_original_price", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column("pending_price_detected_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_column("products", "pending_price_detected_at")
    op.drop_column("products", "pending_original_price")
