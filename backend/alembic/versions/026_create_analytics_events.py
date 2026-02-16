"""create analytics events table

Revision ID: 026_analytics_events
Revises: 025_category_mapping
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "026_analytics_events"
down_revision = "025_category_mapping"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_name", sa.String(length=50), nullable=False),
        sa.Column("session_id", sa.String(length=100), nullable=True),
        sa.Column("path", sa.String(length=500), nullable=True),
        sa.Column("referrer", sa.String(length=1000), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("subcategory", sa.String(length=100), nullable=True),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("product_slug", sa.String(length=255), nullable=True),
        sa.Column("search_query", sa.String(length=200), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_analytics_events_id"), "analytics_events", ["id"], unique=False)
    op.create_index(op.f("ix_analytics_events_event_name"), "analytics_events", ["event_name"], unique=False)
    op.create_index(op.f("ix_analytics_events_session_id"), "analytics_events", ["session_id"], unique=False)
    op.create_index(op.f("ix_analytics_events_product_id"), "analytics_events", ["product_id"], unique=False)
    op.create_index(op.f("ix_analytics_events_product_slug"), "analytics_events", ["product_slug"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_analytics_events_product_slug"), table_name="analytics_events")
    op.drop_index(op.f("ix_analytics_events_product_id"), table_name="analytics_events")
    op.drop_index(op.f("ix_analytics_events_session_id"), table_name="analytics_events")
    op.drop_index(op.f("ix_analytics_events_event_name"), table_name="analytics_events")
    op.drop_index(op.f("ix_analytics_events_id"), table_name="analytics_events")
    op.drop_table("analytics_events")
