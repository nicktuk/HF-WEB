"""add position to sections

Revision ID: 036_section_position
Revises: 035_sp_updated_at
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "036_section_position"
down_revision = "035_sp_updated_at"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column(
        "sections",
        sa.Column("position", sa.String(10), nullable=False, server_default="abajo")
    )

def downgrade() -> None:
    op.drop_column("sections", "position")
