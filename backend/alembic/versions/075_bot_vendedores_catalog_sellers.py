"""add celular_normalizado + bot_habilitado to catalog_sellers

Revision ID: 075
Revises: 074
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = '075'
down_revision = '074'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('catalog_sellers', sa.Column('celular_normalizado', sa.String(length=20), nullable=True))
    op.add_column('catalog_sellers', sa.Column('bot_habilitado', sa.Boolean(), nullable=False, server_default='true'))
    op.create_unique_constraint(
        'uq_catalog_sellers_celular_normalizado', 'catalog_sellers', ['celular_normalizado']
    )

    from app.core.phone import normalizar_celular

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, celular FROM catalog_sellers")).fetchall()
    for row in rows:
        if not row.celular:
            continue
        conn.execute(
            sa.text("UPDATE catalog_sellers SET celular_normalizado = :cel WHERE id = :id"),
            {"cel": normalizar_celular(row.celular), "id": row.id},
        )


def downgrade():
    op.drop_constraint('uq_catalog_sellers_celular_normalizado', 'catalog_sellers', type_='unique')
    op.drop_column('catalog_sellers', 'bot_habilitado')
    op.drop_column('catalog_sellers', 'celular_normalizado')
