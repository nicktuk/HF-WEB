"""Las '4 pantallas del vendedor' (Bloque 4): Mi día, Mi cartera, Catálogo
demo y Mi plata, más la gestión de prospectos y el alta directa de cliente
desde la tablet.

Reutiliza comercio_catalog para precios (misma fuente de verdad que el
catálogo del comerciante) y comercio_pedidos.calcular_semaforo para el
semáforo de recompra — nada de esto duplica lógica ya existente.
"""
from datetime import date

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.comercio import (
    Comercio,
    ConfiguracionComercio,
    Comision,
    PedidoComercio,
    Prospecto,
)
from app.models.product_comercio import ProductComercioConfig, ProductComercioImage
from app.services import comercio_catalog, comercio_pedidos

ESTADOS_PROSPECTO = {"interesado", "lo_pienso", "no_va", "convertido"}


# ─── Mi cartera ─────────────────────────────────────────────────────────────

def get_mi_cartera(db: Session, vendedor_id: int) -> list[dict]:
    cfg = db.query(ConfiguracionComercio).first()
    comercios = (
        db.query(Comercio)
        .filter(Comercio.vendedor_id == vendedor_id, Comercio.estado == "activo")
        .order_by(Comercio.nombre_local)
        .all()
    )
    return [
        {
            "id": c.id,
            "nombre_local": c.nombre_local,
            "nombre": f"{c.nombre} {c.apellido}",
            "celular": c.celular,
            "ubicacion_local": c.ubicacion_local,
            "semaforo": comercio_pedidos.calcular_semaforo(db, c, cfg),
        }
        for c in comercios
    ]


# ─── Mi día ─────────────────────────────────────────────────────────────────

def get_mi_dia(db: Session, vendedor_id: int) -> dict:
    """Recorrido del día: entregas primero, clientes a reactivar después,
    prospectos en los huecos (mismo orden que indica el manual del vendedor)."""
    cfg = db.query(ConfiguracionComercio).first()

    entregas_pendientes = (
        db.query(PedidoComercio)
        .join(Comercio, Comercio.id == PedidoComercio.comercio_id)
        .filter(
            Comercio.vendedor_id == vendedor_id,
            PedidoComercio.estado.in_(["confirmado", "preparando"]),
        )
        .order_by(PedidoComercio.fecha_reserva_hasta.asc().nulls_last(), PedidoComercio.id.asc())
        .all()
    )

    cartera = get_mi_cartera(db, vendedor_id)
    reactivar = [c for c in cartera if c["semaforo"]["color"] in ("amarillo", "rojo")]

    hoy = date.today()
    prospectos_hoy = (
        db.query(Prospecto)
        .filter(
            Prospecto.vendedor_id == vendedor_id,
            Prospecto.estado.in_(["interesado", "lo_pienso"]),
        )
        .filter((Prospecto.fecha_proximo_contacto.is_(None)) | (Prospecto.fecha_proximo_contacto <= hoy))
        .order_by(Prospecto.fecha_proximo_contacto.asc().nulls_first())
        .all()
    )

    return {
        "entregas_pendientes": [
            {
                "pedido_id": p.id,
                "comercio_id": p.comercio_id,
                "comercio_nombre": p.comercio.nombre_local if p.comercio else None,
                "estado": p.estado,
                "total": float(p.total),
                "fecha_reserva_hasta": p.fecha_reserva_hasta.isoformat() if p.fecha_reserva_hasta else None,
            }
            for p in entregas_pendientes
        ],
        "reactivar": reactivar,
        "prospectos": [_prospecto_dict(p) for p in prospectos_hoy],
    }


# ─── Mi plata ───────────────────────────────────────────────────────────────

def get_mi_plata(db: Session, vendedor_id: int) -> dict:
    comisiones = (
        db.query(Comision)
        .filter(Comision.vendedor_id == vendedor_id)
        .order_by(Comision.id.desc())
        .all()
    )
    items = [
        {
            "id": c.id,
            "pedido_id": c.pedido_id,
            "comercio_nombre": (
                c.pedido.comercio.nombre_local if c.pedido and c.pedido.comercio else None
            ),
            "base": float(c.base),
            "tasa": float(c.tasa),
            "monto": float(c.monto),
            "estado": c.estado,
        }
        for c in comisiones
    ]
    return {
        "items": items,
        "total_pendiente": sum(i["monto"] for i in items if i["estado"] == "pendiente"),
        "total_liquidado": sum(i["monto"] for i in items if i["estado"] == "liquidada"),
    }


# ─── Catálogo demo ──────────────────────────────────────────────────────────

def _imagen_url(db: Session, product_id: int) -> str | None:
    img = (
        db.query(ProductComercioImage)
        .filter(ProductComercioImage.product_id == product_id)
        .order_by(ProductComercioImage.display_order)
        .first()
    )
    return img.url if img else None


def get_catalogo_demo(db: Session) -> list[dict]:
    """Catálogo con precio mayorista, precio de público y ganancia por unidad
    en cada escalón de la matriz de descuento — lo que el vendedor necesita
    para armar la cuenta en voz alta frente al comerciante (Manual del
    Vendedor, Paso 1)."""
    cfg = comercio_catalog.get_config(db)
    visibles = comercio_catalog.productos_visibles(db, cfg)
    tramos = comercio_catalog.get_tramos_descuento(db) if cfg.modo_precio == 'descuento' else []

    items = []
    for p, costo, stock, config in visibles:
        override = config.precio_mayorista_override if config else None
        precio_base = comercio_catalog.precio_referencia(costo, override, cfg, p.final_price)
        precio_venta = p.final_price

        escalones = []
        cantidades = sorted({t["cantidad_minima"] for t in tramos}) or [1]
        for cantidad in cantidades:
            precio_u = comercio_catalog.precio_comercio(costo, override, cfg, precio_venta, cantidad, tramos)
            ganancia = (precio_venta - int(precio_u)) if precio_venta is not None else None
            escalones.append({
                "cantidad_minima": cantidad,
                "precio_unitario": int(precio_u),
                "ganancia_unitaria": ganancia,
            })

        items.append({
            "id": p.id,
            "nombre": p.display_name,
            "marca": p.brand,
            "precio_comercio": int(precio_base),
            "precio_venta": precio_venta,
            "ganancia_unitaria": (precio_venta - int(precio_base)) if precio_venta is not None else None,
            "stock": stock,
            "imagen_url": _imagen_url(db, p.id),
            "cantidad_minima": config.cantidad_minima if config else None,
            "escalones": escalones,
        })
    return items


# ─── Prospectos ─────────────────────────────────────────────────────────────

def _prospecto_dict(p: Prospecto) -> dict:
    return {
        "id": p.id,
        "comercio_nombre": p.comercio_nombre,
        "whatsapp": p.whatsapp,
        "direccion": p.direccion,
        "estado": p.estado,
        "fecha_proximo_contacto": p.fecha_proximo_contacto.isoformat() if p.fecha_proximo_contacto else None,
        "notas": p.notas,
        "comercio_id": p.comercio_id,
    }


def listar_prospectos(db: Session, vendedor_id: int) -> list[dict]:
    prospectos = (
        db.query(Prospecto)
        .filter(Prospecto.vendedor_id == vendedor_id)
        .order_by(Prospecto.fecha_proximo_contacto.asc().nulls_first(), Prospecto.id.desc())
        .all()
    )
    return [_prospecto_dict(p) for p in prospectos]


def crear_prospecto(
    db: Session,
    vendedor_id: int,
    comercio_nombre: str,
    whatsapp: str,
    direccion: str | None = None,
    fecha_proximo_contacto: date | None = None,
    notas: str | None = None,
) -> dict:
    if not comercio_nombre.strip() or not whatsapp.strip():
        raise ValidationError("comercio_nombre y whatsapp son obligatorios")

    p = Prospecto(
        vendedor_id=vendedor_id,
        comercio_nombre=comercio_nombre.strip(),
        whatsapp=whatsapp.strip(),
        direccion=direccion,
        estado="interesado",
        fecha_proximo_contacto=fecha_proximo_contacto,
        notas=notas,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _prospecto_dict(p)


def actualizar_prospecto(db: Session, vendedor_id: int, prospecto_id: int, cambios: dict) -> dict:
    p = (
        db.query(Prospecto)
        .filter(Prospecto.id == prospecto_id, Prospecto.vendedor_id == vendedor_id)
        .first()
    )
    if not p:
        raise NotFoundError("Prospecto", str(prospecto_id))

    if "estado" in cambios:
        estado = cambios["estado"]
        if estado not in ESTADOS_PROSPECTO:
            raise ValidationError(f"estado debe ser uno de: {', '.join(sorted(ESTADOS_PROSPECTO))}")
        if p.estado == "convertido":
            raise ValidationError("Un prospecto convertido no cambia de estado.")
        p.estado = estado
    if "fecha_proximo_contacto" in cambios:
        p.fecha_proximo_contacto = cambios["fecha_proximo_contacto"]
    if "notas" in cambios:
        p.notas = cambios["notas"]
    if "direccion" in cambios:
        p.direccion = cambios["direccion"]

    db.commit()
    db.refresh(p)
    return _prospecto_dict(p)


def convertir_prospecto(
    db: Session,
    vendedor_id: int,
    prospecto_id: int,
    datos_comercio: dict,
) -> Comercio:
    """Da de alta al Comercio real a partir de un prospecto ya visitado. La
    cuenta queda 'pendiente' igual que cualquier alta — la aprueba admin —
    pero ya atribuida a la cartera del vendedor que hizo la prospección."""
    p = (
        db.query(Prospecto)
        .filter(Prospecto.id == prospecto_id, Prospecto.vendedor_id == vendedor_id)
        .first()
    )
    if not p:
        raise NotFoundError("Prospecto", str(prospecto_id))
    if p.estado == "convertido":
        raise ValidationError("Este prospecto ya fue convertido.")

    comercio = _crear_comercio(db, vendedor_id, datos_comercio)

    p.estado = "convertido"
    p.comercio_id = comercio.id
    db.commit()
    db.refresh(comercio)
    return comercio


def _crear_comercio(db: Session, vendedor_id: int, datos: dict) -> Comercio:
    from app.services.comercio_auth import hash_password

    requeridos = ["nombre", "apellido", "usuario", "password", "nombre_local", "ubicacion_local"]
    faltantes = [c for c in requeridos if not (datos.get(c) or "").strip()]
    if faltantes:
        raise ValidationError(f"Faltan campos obligatorios: {', '.join(faltantes)}")
    if not datos.get("celular") and not datos.get("email"):
        raise ValidationError("Ingresá al menos un celular o email.")

    comercio = Comercio(
        nombre=datos["nombre"].strip(),
        apellido=datos["apellido"].strip(),
        usuario=datos["usuario"].strip().lower(),
        password_hash=hash_password(datos["password"]),
        celular=datos.get("celular"),
        email=datos.get("email"),
        nombre_local=datos["nombre_local"].strip(),
        ubicacion_local=datos["ubicacion_local"].strip(),
        rubro=(datos.get("rubro") or "").strip() or None,
        estado="pendiente",
        vendedor_id=vendedor_id,
    )
    db.add(comercio)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValidationError("Ese usuario ya está en uso. Elegí otro.")
    db.refresh(comercio)
    return comercio


def crear_cliente_desde_vendedor(db: Session, vendedor_id: int, datos: dict) -> Comercio:
    """Alta directa desde la tablet, sin pasar por un prospecto previo
    (Especificación Funcional §3: 'la carga el vendedor, en el momento')."""
    return _crear_comercio(db, vendedor_id, datos)
