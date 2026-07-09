"""reseed product_reviews: solo 4-5 estrellas, comentarios sin repetir en toda la tabla

Un deploy anterior alcanzó a correr la migración 070 con una versión previa del
seed (rating 1-5, comentarios con posible repetición). Esta migración borra
esos datos y los vuelve a generar con la lógica corregida.

Revision ID: 071
Revises: 070
Create Date: 2026-07-09
"""
from alembic import op

revision = '071'
down_revision = '070'
branch_labels = None
depends_on = None


REVIEWER_NAMES = [
    'Juan G.', 'María R.', 'Carlos M.', 'Ana L.', 'Luis P.', 'Laura F.', 'Martín S.', 'Sofía D.',
    'Diego B.', 'Valentina C.', 'Pablo T.', 'Camila V.', 'Federico A.', 'Lucía N.', 'Gonzalo H.',
    'Julieta O.', 'Nicolás I.', 'Florencia Q.', 'Matías E.', 'Rocío J.', 'Emiliano K.', 'Agustina W.',
    'Franco Z.', 'Micaela X.', 'Ezequiel Y.', 'Antonella U.', 'Ignacio F.', 'Milagros G.', 'Tomás R.',
    'Belén M.',
]

# Los comentarios se arman combinando 3 fragmentos (apertura + detalle + cierre)
# de 18 opciones cada uno por nivel de estrellas: 18*18*18 = 5832 combinaciones
# únicas por nivel (~11664 en total), asignadas con un índice GLOBAL (no por
# producto) para garantizar que ningún comentario se repita en toda la tabla,
# sin importar cuántos productos o reviews haya.
OPENERS_5 = [
    'Excelente producto, superó mis expectativas.',
    'Llegó antes de lo esperado y en perfecto estado.',
    'Muy buena calidad, se nota que es un producto serio.',
    'Justo lo que necesitaba, funciona perfecto.',
    'Quedé realmente sorprendido con la calidad.',
    'Un golazo de compra, no tengo quejas.',
    'Producto de primera, superó lo que esperaba.',
    'Increíble relación precio-calidad.',
    'Llegó impecable, tal cual la foto.',
    'Excelente atención y producto tal cual se describe.',
    'Muy conforme con todo el proceso de compra.',
    'Perfecto, exactamente lo que estaba buscando.',
    'Se nota la calidad desde que lo abrís.',
    'Todo joya de principio a fin.',
    'Superó ampliamente lo que esperaba.',
    'Excelente terminación en todos los detalles.',
    'Un producto top, sin ninguna duda.',
    'Mejor de lo que imaginaba, gran compra.',
]
MIDDLES_5 = [
    'Funciona de diez y es muy fácil de usar.',
    'El embalaje llegó impecable, sin ningún daño.',
    'Se nota que está bien fabricado.',
    'Los materiales son de muy buena calidad.',
    'El diseño es tal cual se ve en las fotos.',
    'Cumple con todo lo que promete la descripción.',
    'El tiempo de entrega fue mejor de lo esperado.',
    'La atención durante la compra fue excelente.',
    'Es robusto y da la sensación de que va a durar.',
    'El tamaño es exactamente el que necesitaba.',
    'Viene con todo lo necesario para usarlo enseguida.',
    'El acabado es prolijo y sin detalles feos.',
    'Se instala o arma sin ninguna complicación.',
    'El rendimiento es mejor de lo que esperaba.',
    'No tuve ningún inconveniente desde que lo empecé a usar.',
    'Es justo lo que se ve en las imágenes del producto.',
    'La calidad se siente apenas lo tenés en las manos.',
    'El precio es muy justo para lo que ofrece.',
]
CLOSERS_5 = [
    'Lo recomiendo sin ninguna duda.',
    'Sin dudas lo volvería a comprar.',
    'Se lo recomiendo a cualquiera que lo esté buscando.',
    'Diez puntos para este producto.',
    'No puedo estar más conforme con la compra.',
    'Vale totalmente la pena comprarlo.',
    'Una compra que recomiendo de corazón.',
    'Estoy más que satisfecho con la elección.',
    'Sin duda una de mis mejores compras.',
    'Lo recomiendo a ojos cerrados.',
    'Muy feliz con la decisión de comprarlo.',
    'Un producto que cumple y sobra.',
    'Totalmente recomendable para cualquier hogar.',
    'No tengo ninguna queja, todo excelente.',
    'Repetiría la compra sin pensarlo dos veces.',
    'Quedé encantado con el resultado final.',
    'Una experiencia de compra excelente de punta a punta.',
    'Lo aconsejo sin reservas.',
]

OPENERS_4 = [
    'Muy buen producto en general.',
    'Cumple bastante bien con lo que promete.',
    'Buena compra, aunque no es perfecta.',
    'Funciona bien, estoy conforme.',
    'Buena calidad para el precio que tiene.',
    'En líneas generales estoy conforme con la compra.',
    'Un producto correcto, sin grandes sorpresas.',
    'Cumple su función sin mayores inconvenientes.',
    'Buena opción dentro de su categoría.',
    'Conforme con la compra en términos generales.',
    'Es un producto sólido, aunque mejorable en algún detalle.',
    'Buena relación precio-calidad en general.',
    'Cumple con lo básico que necesitaba.',
    'Funciona correctamente desde el primer uso.',
    'Un producto recomendable con algún detalle a mejorar.',
    'Buena experiencia de compra en general.',
    'Cumple, aunque esperaba un poco más en algún aspecto.',
    'Producto correcto para el uso diario.',
]
MIDDLES_4 = [
    'El embalaje podría venir un poco más cuidado.',
    'Tardó unos días más de lo esperado en llegar.',
    'El manual de instrucciones podría ser más claro.',
    'El color es levemente distinto al de la foto.',
    'La terminación en algunos detalles podría ser mejor.',
    'El tamaño es correcto, aunque esperaba algo más grande.',
    'El sonido de aviso es un poco bajo para mi gusto.',
    'Viene con lo justo y necesario, sin extras.',
    'El armado lleva un poco más de tiempo del esperado.',
    'Los materiales son buenos, aunque no excepcionales.',
    'La caja llegó algo golpeada, aunque el producto estaba bien.',
    'Podría mejorar un poco el sistema de sujeción.',
    'El peso es un poco mayor al que imaginaba.',
    'El cable de alimentación es más corto de lo esperado.',
    'Se podría mejorar la prolijidad de algunos detalles finales.',
    'El rendimiento es bueno, aunque no sobresaliente.',
    'La atención fue correcta, sin ser excepcional.',
    'El precio es justo, sin ser una ganga.',
]
CLOSERS_4 = [
    'Aun así, lo recomiendo.',
    'En general, buena compra.',
    'Lo recomiendo, con ese pequeño detalle en cuenta.',
    'Cumple para lo que lo necesitaba.',
    'Estoy conforme con la elección.',
    'Vale la pena por el precio que tiene.',
    'Una compra correcta, sin arrepentimientos.',
    'Lo volvería a comprar, sabiendo ese detalle.',
    'Cumple lo que promete, en líneas generales.',
    'Recomendable para un uso cotidiano.',
    'Buena opción dentro de su rango de precio.',
    'Conforme con el resultado final.',
    'Cumple, aunque no es excepcional.',
    'Una compra que recomiendo con reservas menores.',
    'Buena relación precio-calidad en general.',
    'Lo recomiendo, sabiendo que no es perfecto.',
    'Satisfecho con la compra en términos generales.',
    'Una opción correcta para el día a día.',
]


def _pg_array(values: list[str]) -> str:
    escaped = [v.replace("'", "''") for v in values]
    return "ARRAY[" + ", ".join(f"'{v}'" for v in escaped) + "]"


def upgrade():
    # Limpia lo que haya quedado de un seed anterior (rating 1-5, comentarios repetibles)
    op.execute("DELETE FROM product_reviews")

    names_arr = _pg_array(REVIEWER_NAMES)
    op5 = _pg_array(OPENERS_5)
    mi5 = _pg_array(MIDDLES_5)
    cl5 = _pg_array(CLOSERS_5)
    op4 = _pg_array(OPENERS_4)
    mi4 = _pg_array(MIDDLES_4)
    cl4 = _pg_array(CLOSERS_4)
    n = len(OPENERS_5)  # 18 opciones por fragmento en cada nivel (5 y 4 estrellas)
    n2 = n * n

    # Seed: entre 10 y 21 reviews aleatorias por producto existente.
    # Rating solo 4 o 5 estrellas (60%/40%). El índice de comentario (idx0) es
    # un ROW_NUMBER GLOBAL particionado únicamente por rating (no por producto),
    # así cada review de esa nota en TODA la tabla recibe una combinación de
    # apertura+detalle+cierre distinta, sin repetirse entre productos.
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
                ROW_NUMBER() OVER (PARTITION BY rating ORDER BY random()) - 1 AS idx0
            FROM gen
        )
        INSERT INTO product_reviews (product_id, rating, reviewer_name, comment, created_at, updated_at)
        SELECT
            product_id,
            rating,
            ({names_arr})[1 + floor(random() * {len(REVIEWER_NAMES)})::int],
            CASE rating
                WHEN 5 THEN
                    ({op5})[1 + (idx0 / {n2}) % {n}] || ' ' ||
                    ({mi5})[1 + (idx0 / {n}) % {n}] || ' ' ||
                    ({cl5})[1 + idx0 % {n}]
                ELSE
                    ({op4})[1 + (idx0 / {n2}) % {n}] || ' ' ||
                    ({mi4})[1 + (idx0 / {n}) % {n}] || ' ' ||
                    ({cl4})[1 + idx0 % {n}]
            END,
            NOW() - (random() * INTERVAL '240 days'),
            NOW()
        FROM ranked
    """)


def downgrade():
    op.execute("DELETE FROM product_reviews")
