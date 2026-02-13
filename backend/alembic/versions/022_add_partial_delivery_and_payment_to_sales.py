"""Add partial delivery and payment fields to sales

Revision ID: 022
Revises: 021
Create Date: 2026-02-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sales",
        sa.Column("delivered_amount", sa.Numeric(12, 2), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "sales",
        sa.Column("paid_amount", sa.Numeric(12, 2), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "sale_items",
        sa.Column("delivered_quantity", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )

    op.execute(
        """
        UPDATE sales
        SET delivered_amount = CASE WHEN delivered THEN total_amount ELSE 0 END,
            paid_amount = CASE WHEN paid THEN total_amount ELSE 0 END
        """
    )
    op.execute(
        """
        UPDATE sale_items si
        SET delivered_quantity = CASE WHEN s.delivered THEN si.quantity ELSE 0 END
        FROM sales s
        WHERE s.id = si.sale_id
        """
    )


def downgrade() -> None:
    op.drop_column("sale_items", "delivered_quantity")
    op.drop_column("sales", "paid_amount")
    op.drop_column("sales", "delivered_amount")
