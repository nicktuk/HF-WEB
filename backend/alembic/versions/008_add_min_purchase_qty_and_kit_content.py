"""Add min_purchase_qty and kit_content to products

Revision ID: 008
Revises: 007
Create Date: 2026-02-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    # Add min_purchase_qty column (minimum purchase quantity)
    op.add_column(
        'products',
        sa.Column('min_purchase_qty', sa.Integer(), nullable=True, comment='Cantidad minima de compra')
    )
    # Add kit_content column (content description for kits/combos)
    op.add_column(
        'products',
        sa.Column('kit_content', sa.Text(), nullable=True, comment='Contenido del kit/combo')
    )


def downgrade():
    op.drop_column('products', 'kit_content')
    op.drop_column('products', 'min_purchase_qty')
