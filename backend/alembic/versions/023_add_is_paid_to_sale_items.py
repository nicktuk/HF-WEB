"""Add item-level paid flag to sale items

Revision ID: 023
Revises: 022
Create Date: 2026-02-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sale_items",
        sa.Column("is_paid", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )

    # Backfill: fully paid sales mark all items as paid.
    op.execute(
        """
        UPDATE sale_items si
        SET is_paid = true
        FROM sales s
        WHERE s.id = si.sale_id
          AND (
            s.paid = true
            OR COALESCE(s.paid_amount, 0) >= COALESCE(s.total_amount, 0)
          )
        """
    )


def downgrade() -> None:
    op.drop_column("sale_items", "is_paid")
