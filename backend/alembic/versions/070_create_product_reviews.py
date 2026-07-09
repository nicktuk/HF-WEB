"""create product_reviews table and seed random reviews for existing products

Revision ID: 070
Revises: 069
Create Date: 2026-07-09
"""
from alembic import op

revision = '070'
down_revision = '069'
branch_labels = None
depends_on = None


REVIEWER_NAMES = [
    'Juan G.', 'María R.', 'Carlos M.', 'Ana L.', 'Luis P.', 'Laura F.', 'Martín S.', 'Sofía D.',
    'Diego B.', 'Valentina C.', 'Pablo T.', 'Camila V.', 'Federico A.', 'Lucía N.', 'Gonzalo H.',
    'Julieta O.', 'Nicolás I.', 'Florencia Q.', 'Matías E.', 'Rocío J.', 'Emiliano K.', 'Agustina W.',
    'Franco Z.', 'Micaela X.', 'Ezequiel Y.', 'Antonella U.', 'Ignacio F.', 'Milagros G.', 'Tomás R.',
    'Belén M.',
]

COMMENTS_5 = [
    'Excelente producto, superó mis expectativas.',
    'Llegó rápido y tal cual la descripción. Recomendable.',
    'Muy buena calidad, lo volvería a comprar.',
    'Justo lo que necesitaba, funciona perfecto.',
    'Buenísima relación precio-calidad.',
]
COMMENTS_4 = [
    'Muy bueno, aunque tardó un poco en llegar.',
    'Cumple con lo esperado, buena compra.',
    'Buen producto, lo recomiendo.',
    'Funciona bien, estoy conforme.',
]
COMMENTS_3 = [
    'Está bien, nada del otro mundo.',
    'Cumple pero esperaba un poco más.',
    'Es correcto para el precio.',
]
COMMENTS_2 = [
    'No es lo que esperaba, calidad regular.',
    'Tuve algunos problemas con el producto.',
]
COMMENTS_1 = [
    'No cumplió mis expectativas.',
    'Llegó con un defecto.',
]


def _pg_array(values: list[str]) -> str:
    escaped = [v.replace("'", "''") for v in values]
    return "ARRAY[" + ", ".join(f"'{v}'" for v in escaped) + "]"


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

    names_arr = _pg_array(REVIEWER_NAMES)
    c5_arr = _pg_array(COMMENTS_5)
    c4_arr = _pg_array(COMMENTS_4)
    c3_arr = _pg_array(COMMENTS_3)
    c2_arr = _pg_array(COMMENTS_2)
    c1_arr = _pg_array(COMMENTS_1)

    # Seed: al menos 10 (hasta 21) reviews aleatorias por producto existente,
    # con distribución de estrellas mayormente positiva y comentario acorde a la nota.
    op.execute(f"""
        INSERT INTO product_reviews (product_id, rating, reviewer_name, comment, created_at, updated_at)
        SELECT
            gen.product_id,
            gen.rating,
            {names_arr}[1 + floor(random() * {len(REVIEWER_NAMES)})::int],
            CASE gen.rating
                WHEN 5 THEN {c5_arr}[1 + floor(random() * {len(COMMENTS_5)})::int]
                WHEN 4 THEN {c4_arr}[1 + floor(random() * {len(COMMENTS_4)})::int]
                WHEN 3 THEN {c3_arr}[1 + floor(random() * {len(COMMENTS_3)})::int]
                WHEN 2 THEN {c2_arr}[1 + floor(random() * {len(COMMENTS_2)})::int]
                ELSE {c1_arr}[1 + floor(random() * {len(COMMENTS_1)})::int]
            END,
            NOW() - (random() * INTERVAL '240 days'),
            NOW()
        FROM (
            SELECT
                p.id AS product_id,
                (CASE
                    WHEN r.v < 0.45 THEN 5
                    WHEN r.v < 0.75 THEN 4
                    WHEN r.v < 0.90 THEN 3
                    WHEN r.v < 0.97 THEN 2
                    ELSE 1
                END) AS rating
            FROM products p
            CROSS JOIN LATERAL generate_series(1, 10 + floor(random() * 12)::int) AS s(n)
            CROSS JOIN LATERAL (SELECT random() AS v) r
        ) gen
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS product_reviews")
