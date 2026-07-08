"""add codigo_interno and mostrar_codigo to products

Revision ID: 069
Revises: 068
Create Date: 2026-07-08
"""
import random

from alembic import op
import sqlalchemy as sa

revision = '069'
down_revision = '068'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('codigo_interno', sa.String(7), nullable=True))
    op.add_column(
        'products',
        sa.Column('mostrar_codigo', sa.Boolean(), nullable=False, server_default='false'),
    )

    # Backfill: generar un código HFXXXXX único para cada producto existente
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id FROM products")).fetchall()
    used_codes = set()
    for row in rows:
        while True:
            code = "HF" + "".join(str(random.randint(0, 9)) for _ in range(5))
            if code not in used_codes:
                used_codes.add(code)
                break
        connection.execute(
            sa.text("UPDATE products SET codigo_interno = :code WHERE id = :id"),
            {"code": code, "id": row.id},
        )

    op.create_index('ix_products_codigo_interno', 'products', ['codigo_interno'], unique=True)


def downgrade():
    op.drop_index('ix_products_codigo_interno', table_name='products')
    op.drop_column('products', 'mostrar_codigo')
    op.drop_column('products', 'codigo_interno')
