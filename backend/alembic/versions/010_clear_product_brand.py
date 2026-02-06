"""Clear brand field for all products

Revision ID: 010
Revises: 009
Create Date: 2026-02-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE products SET brand = ''")


def downgrade():
    # Irreversible data change; leave as no-op
    pass
