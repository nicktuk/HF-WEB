"""Allow manual products in sale items

Revision ID: 024
Revises: 023
Create Date: 2026-02-14 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sale_items",
        sa.Column("manual_product_name", sa.String(length=500), nullable=True),
    )
    op.alter_column(
        "sale_items",
        "product_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "sale_items",
        "product_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_column("sale_items", "manual_product_name")
