"""unificar Vendedor (mayorista) y CatalogSeller (minorista) en una sola tabla

catalog_sellers pasa a ser LA tabla de vendedores: gana un flag es_mayorista
que, activado, habilita todo lo que hoy usa el canal comercios (login al
portal, cartera, prospectos, comisiones). Se eligió que sobreviva
catalog_sellers (no vendedores) porque Sale.seller_id y Order.seller_id ya
apuntan ahí, y reapuntar esas FKs sería mucho más riesgoso que migrar la
tabla más chica (vendedores) hacia la que ya tiene el historial de ventas.

Revision ID: 099
Revises: 098
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

from app.core.phone import normalizar_celular

revision = '099'
down_revision = '098'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ─── 1. Columnas nuevas en catalog_sellers ─────────────────────────────
    op.add_column('catalog_sellers', sa.Column('es_mayorista', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('catalog_sellers', sa.Column('email', sa.Text(), nullable=True))
    op.add_column('catalog_sellers', sa.Column('usuario', sa.Text(), nullable=True))
    op.add_column('catalog_sellers', sa.Column('password_hash', sa.Text(), nullable=True))
    op.add_column('catalog_sellers', sa.Column('reset_token_hash', sa.Text(), nullable=True))
    op.add_column('catalog_sellers', sa.Column('reset_token_expires_at', sa.DateTime(), nullable=True))
    op.add_column('catalog_sellers', sa.Column('debe_cambiar_password', sa.Boolean(), nullable=False, server_default='false'))
    op.create_index('ix_catalog_sellers_usuario', 'catalog_sellers', ['usuario'], unique=True)

    # ─── 2. Migrar cada fila de vendedores a su catalog_sellers correspondiente ──
    vendedores = conn.execute(sa.text("""
        SELECT id, nombre, celular_wa, email, activo, usuario, password_hash,
               reset_token_hash, reset_token_expires_at, debe_cambiar_password,
               catalog_seller_id
        FROM vendedores
    """)).mappings().all()

    id_map: dict[int, int] = {}

    for v in vendedores:
        target_id = None

        # a) ya estaba linkeado a mano (trabajo de la sesión anterior) y ese
        #    catalog_seller todavía no fue reclamado por otro vendedor
        if v['catalog_seller_id'] is not None:
            row = conn.execute(
                sa.text("SELECT id, es_mayorista FROM catalog_sellers WHERE id = :id"),
                {"id": v['catalog_seller_id']},
            ).mappings().first()
            if row and not row['es_mayorista']:
                target_id = row['id']

        # b) si no, buscar por nombre exacto (case-insensitive) sin reclamar
        if target_id is None:
            row = conn.execute(
                sa.text("""
                    SELECT id FROM catalog_sellers
                    WHERE lower(nombre) = lower(:nombre) AND es_mayorista = false
                    LIMIT 1
                """),
                {"nombre": v['nombre']},
            ).mappings().first()
            if row:
                target_id = row['id']

        # c) si no hay ningún catalog_seller libre con ese nombre, crear uno
        if target_id is None:
            celular_normalizado = normalizar_celular(v['celular_wa']) if v['celular_wa'] else None
            result = conn.execute(
                sa.text("""
                    INSERT INTO catalog_sellers (nombre, celular, celular_normalizado, bot_habilitado, activo, created_at, updated_at)
                    VALUES (:nombre, :celular, :celular_normalizado, false, :activo, NOW(), NOW())
                    RETURNING id
                """),
                {
                    "nombre": v['nombre'],
                    "celular": v['celular_wa'],
                    "celular_normalizado": celular_normalizado,
                    "activo": v['activo'],
                },
            )
            target_id = result.scalar_one()

        conn.execute(
            sa.text("""
                UPDATE catalog_sellers
                SET es_mayorista = true,
                    email = :email,
                    usuario = :usuario,
                    password_hash = :password_hash,
                    reset_token_hash = :reset_token_hash,
                    reset_token_expires_at = :reset_token_expires_at,
                    debe_cambiar_password = :debe_cambiar_password,
                    activo = :activo
                WHERE id = :id
            """),
            {
                "email": v['email'],
                "usuario": v['usuario'],
                "password_hash": v['password_hash'],
                "reset_token_hash": v['reset_token_hash'],
                "reset_token_expires_at": v['reset_token_expires_at'],
                "debe_cambiar_password": v['debe_cambiar_password'],
                "activo": v['activo'],
                "id": target_id,
            },
        )
        id_map[v['id']] = target_id

    # ─── 3. Soltar las FKs viejas ANTES de remapear (si no, la propia UPDATE
    #    viola la constraint todavía apuntada a vendedores mientras el nuevo
    #    id sólo existe en catalog_sellers) ──────────────────────────────────
    op.drop_constraint('mayoristas_vendedor_id_fkey', 'mayoristas', type_='foreignkey')
    op.drop_constraint('comisiones_vendedor_id_fkey', 'comisiones', type_='foreignkey')
    op.drop_constraint('prospectos_vendedor_id_fkey', 'prospectos', type_='foreignkey')

    # ─── 4. Remapear los valores ────────────────────────────────────────────
    for old_id, new_id in id_map.items():
        conn.execute(sa.text("UPDATE mayoristas SET vendedor_id = :new WHERE vendedor_id = :old"), {"new": new_id, "old": old_id})
        conn.execute(sa.text("UPDATE comisiones SET vendedor_id = :new WHERE vendedor_id = :old"), {"new": new_id, "old": old_id})
        conn.execute(sa.text("UPDATE prospectos SET vendedor_id = :new WHERE vendedor_id = :old"), {"new": new_id, "old": old_id})

    # ─── 5. Recrear las FKs apuntando a catalog_sellers ────────────────────
    op.create_foreign_key('mayoristas_vendedor_id_fkey', 'mayoristas', 'catalog_sellers', ['vendedor_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('comisiones_vendedor_id_fkey', 'comisiones', 'catalog_sellers', ['vendedor_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('prospectos_vendedor_id_fkey', 'prospectos', 'catalog_sellers', ['vendedor_id'], ['id'], ondelete='CASCADE')

    # ─── 6. Chau tabla vieja ────────────────────────────────────────────────
    op.drop_table('vendedores')


def downgrade():
    raise NotImplementedError(
        "La fusión de vendedores en catalog_sellers no es reversible automáticamente "
        "(se pierde la distinción de qué fila era originalmente un catalog_seller puro). "
        "Restaurar desde un backup previo a esta migración si hace falta revertir."
    )
