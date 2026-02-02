"""Sanitize product slugs to remove source website names

Revision ID: 005
Revises: 004
Create Date: 2026-02-02 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # Remove source website names from slugs to protect business information
    # decomoda-XXXX -> prod-XXXX
    op.execute("""
        UPDATE products
        SET slug = REPLACE(slug, 'decomoda-', 'prod-')
        WHERE slug LIKE 'decomoda-%'
    """)

    # redlenic-XXXX -> prod-XXXX
    op.execute("""
        UPDATE products
        SET slug = REPLACE(slug, 'redlenic-', 'prod-')
        WHERE slug LIKE 'redlenic-%'
    """)


def downgrade():
    # Cannot reliably restore original slugs - would need to know the source
    pass
