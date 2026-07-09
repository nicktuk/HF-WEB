"""create product_reviews table

Revision ID: 070
Revises: 069
Create Date: 2026-07-09
"""
from alembic import op

revision = '070'
down_revision = '069'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE product_reviews (
            id             SERIAL PRIMARY KEY,
            product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            rating         INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            reviewer_name  VARCHAR(120) NOT NULL,
            comment        TEXT,
            created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX ix_product_reviews_product_id ON product_reviews (product_id)")
    op.execute("CREATE INDEX ix_product_reviews_product_created ON product_reviews (product_id, created_at)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS product_reviews")
