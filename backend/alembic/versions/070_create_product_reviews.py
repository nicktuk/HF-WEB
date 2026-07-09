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

# Máximo 21 reviews por producto (10 + hasta 11 extra). Cada pool tiene >= 21
# comentarios únicos para poder garantizar, vía ROW_NUMBER() por producto+rating,
# que ningún producto repita un comentario dentro de la misma calificación.
COMMENTS_5 = [
    'Excelente producto, superó mis expectativas.',
    'Llegó rápido y tal cual la descripción. Recomendable.',
    'Muy buena calidad, lo volvería a comprar.',
    'Justo lo que necesitaba, funciona perfecto.',
    'Buenísima relación precio-calidad.',
    'Un golazo, quedé re contento con la compra.',
    'Producto de primera, superó lo que esperaba.',
    'Llegó antes de lo pactado y en perfecto estado.',
    'Increíble calidad para el precio que tiene.',
    'Lo recomiendo sin dudarlo, diez puntos.',
    'Excelente atención y el producto es tal cual la foto.',
    'Muy conforme, cumple con todo lo prometido.',
    'Perfecto, exactamente lo que estaba buscando.',
    'Gran compra, se nota la calidad desde que lo abrís.',
    'Todo joya, llegó rápido y funciona de maravilla.',
    'Superó ampliamente mis expectativas, lo recomiendo totalmente.',
    'Excelente terminación y muy fácil de usar.',
    'Un producto top, no tengo ninguna queja.',
    'Mejor de lo que esperaba, muy buena compra.',
    'Llegó impecable y funciona bárbaro.',
    'Calidad excelente, se los recomiendo a todos.',
    'Volvería a comprar sin pensarlo, muy satisfecho.',
]
COMMENTS_4 = [
    'Muy bueno, aunque tardó un poco en llegar.',
    'Cumple con lo esperado, buena compra.',
    'Buen producto, lo recomiendo.',
    'Funciona bien, estoy conforme.',
    'Buena calidad, aunque el embalaje podría mejorar.',
    'Cumple su función, aunque esperaba un poco más de terminación.',
    'Buena compra en general, sin grandes sorpresas.',
    'Funciona correctamente, cumple lo que promete.',
    'Buen producto, aunque tardó más de lo esperado en llegar.',
    'Conforme con la compra, buena relación precio-calidad.',
    'Es bueno, aunque el manual de instrucciones podría ser más claro.',
    'Cumple, aunque esperaba mejor terminación en algunos detalles.',
    'Buena opción por el precio, sin ser excepcional.',
    'Funciona bien, aunque el color es levemente distinto a la foto.',
    'Producto correcto, cumple con lo que necesitaba.',
    'Buena calidad general, algo justo en algunos detalles.',
    'Estoy conforme, aunque tardó unos días más en llegar.',
    'Cumple bien, buena compra para el uso diario.',
    'Buen producto, aunque esperaba un embalaje más prolijo.',
    'Cumple lo que promete, sin grandes lujos.',
    'Conforme en general, buena opción dentro de su precio.',
    'Funciona correctamente, aunque tardó en llegar unos días extra.',
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

    # Seed: entre 10 y 21 reviews aleatorias por producto existente.
    # Rating solo 4 o 5 estrellas (60%/40%). Comentario elegido sin repetición
    # dentro de cada producto+rating vía ROW_NUMBER() particionado por producto y nota.
    op.execute(f"""
        WITH gen AS (
            SELECT
                p.id AS product_id,
                (CASE WHEN r.v < 0.6 THEN 5 ELSE 4 END) AS rating
            FROM products p
            CROSS JOIN LATERAL generate_series(1, 10 + floor(random() * 12)::int) AS s(n)
            CROSS JOIN LATERAL (SELECT random() AS v) r
        ),
        ranked AS (
            SELECT
                product_id,
                rating,
                ROW_NUMBER() OVER (PARTITION BY product_id, rating ORDER BY random()) AS rn
            FROM gen
        )
        INSERT INTO product_reviews (product_id, rating, reviewer_name, comment, created_at, updated_at)
        SELECT
            product_id,
            rating,
            ({names_arr})[1 + floor(random() * {len(REVIEWER_NAMES)})::int],
            CASE rating
                WHEN 5 THEN ({c5_arr})[rn]
                ELSE ({c4_arr})[rn]
            END,
            NOW() - (random() * INTERVAL '240 days'),
            NOW()
        FROM ranked
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS product_reviews")
