"""Venta espejo de los pedidos de comercio y stock de sus entregas
(services/comercio_pedidos.py)."""
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func

from app.core.exceptions import ValidationError
from app.models.catalog_seller import CatalogSeller
from app.models.comercio import Comercio, Comision, PedidoComercio, PedidoComercioItem
from app.models.product import Product
from app.models.sale import Sale
from app.models.source_website import SourceWebsite
from app.models.stock import StockPurchase
from app.services import comercio_pedidos, vendedor_dashboard
from app.services.sales import SalesService

FOTO = "https://example.com/foto.jpg"


@pytest.fixture
def vendedor(db):
    v = CatalogSeller(nombre="Vendedora", es_mayorista=True)
    db.add(v)
    db.flush()
    return v


@pytest.fixture
def comercio(db, vendedor):
    c = Comercio(
        nombre="Ana",
        apellido="Pérez",
        usuario="ana",
        password_hash="x",
        nombre_local="Bazar Ana",
        ubicacion_local="Centro",
        estado="activo",
        vendedor_id=vendedor.id,
        celular="1122334455",
    )
    db.add(c)
    db.flush()
    return c


@pytest.fixture
def productos(db):
    web = SourceWebsite(name="web", display_name="Web", base_url="https://example.com")
    db.add(web)
    db.flush()
    prods = []
    for i in range(2):
        p = Product(source_website_id=web.id, slug=f"p{i}", original_name=f"Producto {i}")
        db.add(p)
        db.flush()
        db.add(StockPurchase(
            product_id=p.id,
            purchase_date=date(2026, 1, 1),
            unit_price=Decimal("100"),
            quantity=50,
            total_amount=Decimal("5000"),
            out_quantity=0,
        ))
        prods.append(p)
    db.flush()
    return prods


def _stock(db, product):
    return db.query(
        func.sum(StockPurchase.quantity - StockPurchase.out_quantity)
    ).filter(StockPurchase.product_id == product.id).scalar()


def _pedido(db, comercio, productos, estado="recibido"):
    p = PedidoComercio(
        comercio_id=comercio.id,
        estado=estado,
        total=Decimal("0"),
        created_at=datetime(2026, 9, 1, 12, 0),
    )
    db.add(p)
    db.flush()
    total = Decimal("0")
    for prod, cant, precio in zip(productos, (10, 4), (Decimal("150"), Decimal("200"))):
        sub = precio * cant
        total += sub
        db.add(PedidoComercioItem(
            pedido_id=p.id,
            producto_id=prod.id,
            nombre_producto=prod.original_name,
            cantidad=cant,
            precio_unitario=precio,
            subtotal=sub,
        ))
    p.total = total
    db.flush()
    db.refresh(p)
    return p


def _items_por_producto(pedido):
    return {i.producto_id: i for i in pedido.items}


def test_recibido_no_es_venta_y_confirmar_la_crea(db, comercio, productos, vendedor):
    pedido = _pedido(db, comercio, productos)
    assert comercio_pedidos.venta_de_pedido(db, pedido.id) is None

    comercio_pedidos.cambiar_estado(db, pedido.id, "confirmado")

    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert venta is not None
    assert venta.origen == "mayorista"
    assert venta.seller_id == vendedor.id
    assert venta.customer_name == "Bazar Ana"
    assert venta.total_amount == Decimal("2300.00")
    assert venta.created_at == pedido.created_at
    assert not venta.paid and not venta.delivered
    assert venta.paid_amount == 0
    assert sorted(i.quantity for i in venta.items) == [4, 10]
    # Stock intacto: confirmar no entrega nada.
    assert _stock(db, productos[0]) == 50


def test_pago_llega_a_la_venta_sin_comision_minorista(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    comercio_pedidos.registrar_pago(db, pedido.id, "transferencia")

    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert venta.paid
    assert venta.paid_amount == Decimal("2300.00")
    assert venta.payment_method == "Transferencia"
    assert all(i.is_paid and i.paid_at is not None for i in venta.items)
    # La comisión es la mayorista del pedido, nunca una minorista de la venta.
    assert db.query(Comision).filter(Comision.pedido_id == pedido.id).count() == 1
    assert db.query(Comision).filter(Comision.sale_id == venta.id).count() == 0


def test_pago_mercadopago_hefa_usa_la_etiqueta_de_caja(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    comercio_pedidos.registrar_pago(db, pedido.id, "mercadopago_hefa")
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert venta.payment_method == vendedor_dashboard.MERCADOPAGO_HEFA_LABEL


def test_entrega_parcial_descuenta_una_sola_vez_y_corregir_devuelve(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    items = _items_por_producto(pedido)
    p0, p1 = productos

    comercio_pedidos.entregar_pedido(db, pedido.id, FOTO, {items[p0.id].id: 6})
    assert pedido.estado == "entrega_parcial"
    assert _stock(db, p0) == 44
    assert _stock(db, p1) == 50
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert {i.product_id: i.delivered_quantity for i in venta.items} == {p0.id: 6, p1.id: 0}
    assert not venta.delivered

    # Completar: descuenta sólo la diferencia.
    comercio_pedidos.entregar_pedido(db, pedido.id, FOTO, {items[p0.id].id: 10, items[p1.id].id: 4})
    assert pedido.estado == "entregado"
    assert _stock(db, p0) == 40
    assert _stock(db, p1) == 46
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert venta.delivered
    assert venta.delivered_amount == Decimal("2300.00")

    # Corregir a la baja devuelve stock y el pedido vuelve a parcial.
    comercio_pedidos.entregar_pedido(db, pedido.id, FOTO, {items[p0.id].id: 7})
    assert pedido.estado == "entrega_parcial"
    assert _stock(db, p0) == 43
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert {i.product_id: i.delivered_quantity for i in venta.items}[p0.id] == 7

    # Deshacer todo: vuelve a confirmado con el stock completo.
    comercio_pedidos.entregar_pedido(db, pedido.id, FOTO, {items[p0.id].id: 0, items[p1.id].id: 0})
    assert pedido.estado == "confirmado"
    assert _stock(db, p0) == 50
    assert _stock(db, p1) == 50


def test_selector_entregado_descuenta_y_volver_atras_devuelve(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="preparando")
    p0, p1 = productos

    comercio_pedidos.cambiar_estado(db, pedido.id, "entregado")
    assert all(i.cantidad_entregada == i.cantidad for i in pedido.items)
    assert _stock(db, p0) == 40
    assert _stock(db, p1) == 46
    assert comercio_pedidos.venta_de_pedido(db, pedido.id).delivered
    assert len(pedido.entregas) == 1

    comercio_pedidos.cambiar_estado(db, pedido.id, "preparando")
    assert all(i.cantidad_entregada == 0 for i in pedido.items)
    assert _stock(db, p0) == 50
    assert _stock(db, p1) == 50
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert not venta.delivered and venta.delivered_amount == 0


def test_selector_entregado_sobre_parcial_descuenta_solo_lo_pendiente(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    items = _items_por_producto(pedido)
    p0 = productos[0]
    comercio_pedidos.entregar_pedido(db, pedido.id, FOTO, {items[p0.id].id: 6})

    comercio_pedidos.cambiar_estado(db, pedido.id, "entregado")
    assert _stock(db, p0) == 40


def test_selector_no_permite_entrega_parcial(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    with pytest.raises(ValidationError):
        comercio_pedidos.cambiar_estado(db, pedido.id, "entrega_parcial")


def test_cancelar_devuelve_stock_y_borra_venta_y_comision(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    comercio_pedidos.registrar_pago(db, pedido.id, "efectivo")
    comercio_pedidos.cambiar_estado(db, pedido.id, "entregado")
    assert _stock(db, productos[0]) == 40

    comercio_pedidos.cambiar_estado(db, pedido.id, "cancelado")
    assert _stock(db, productos[0]) == 50
    assert _stock(db, productos[1]) == 50
    assert comercio_pedidos.venta_de_pedido(db, pedido.id) is None
    assert db.query(Comision).filter(Comision.pedido_id == pedido.id).count() == 0


def test_no_se_cancela_con_comision_liquidada(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    comercio_pedidos.registrar_pago(db, pedido.id, "efectivo")
    comision = db.query(Comision).filter(Comision.pedido_id == pedido.id).one()
    comision.estado = "liquidada"
    db.flush()

    with pytest.raises(ValidationError):
        comercio_pedidos.cambiar_estado(db, pedido.id, "cancelado")
    assert comercio_pedidos.venta_de_pedido(db, pedido.id) is not None


def test_eliminar_la_venta_cancela_el_pedido_y_devuelve_stock(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    comercio_pedidos.cambiar_estado(db, pedido.id, "entregado")
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)

    SalesService(db).delete_sale(venta.id)

    db.refresh(pedido)
    assert pedido.estado == "cancelado"
    assert _stock(db, productos[0]) == 50
    assert db.query(Sale).filter(Sale.id == venta.id).count() == 0


def test_la_venta_no_se_edita_desde_ventas(db, comercio, productos):
    pedido = _pedido(db, comercio, productos)
    comercio_pedidos.cambiar_estado(db, pedido.id, "confirmado")
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    service = SalesService(db)

    with pytest.raises(ValidationError):
        service.update_sale(venta.id, delivered=True, paid=None)
    with pytest.raises(ValidationError):
        service.mark_item_paid(venta.id, venta.items[0].id, "Efectivo")
    with pytest.raises(ValidationError):
        service.mark_item_delivered(venta.id, venta.items[0].id)
    assert _stock(db, productos[0]) == 50


def test_comercio_sin_vendedor_crea_la_venta_al_asignarlo(db, comercio, productos, vendedor):
    comercio.vendedor_id = None
    db.flush()
    pedido = _pedido(db, comercio, productos)
    comercio_pedidos.cambiar_estado(db, pedido.id, "confirmado")
    assert comercio_pedidos.venta_de_pedido(db, pedido.id) is None

    comercio.vendedor_id = vendedor.id
    db.flush()
    comercio_pedidos.sincronizar_ventas_comercio(db, comercio.id)
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert venta is not None and venta.seller_id == vendedor.id


def test_generar_ventas_de_pedidos_existentes(db, comercio, productos):
    # Pedido anterior a la venta espejo: entregado y cobrado, sin venta.
    pedido = _pedido(db, comercio, productos, estado="entregado")
    for item in pedido.items:
        item.cantidad_entregada = item.cantidad
    pedido.estado_pago = "pagado"
    pedido.metodo_pago = "efectivo"
    recibido = _pedido(db, comercio, productos, estado="recibido")
    db.flush()

    preview = comercio_pedidos.preview_generar_ventas(db)
    assert [p["pedido_id"] for p in preview["a_generar"]] == [pedido.id]

    resultado = comercio_pedidos.generar_ventas_pendientes(db)
    assert resultado["generadas"] == [pedido.id]
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert venta.paid and venta.delivered
    assert venta.created_at == pedido.created_at
    assert comercio_pedidos.venta_de_pedido(db, recibido.id) is None
    # No toca stock: lo entregado ya se había descontado en su momento.
    assert _stock(db, productos[0]) == 50
    # Idempotente.
    assert comercio_pedidos.generar_ventas_pendientes(db)["generadas"] == []


def test_la_venta_no_aparece_en_mis_ventas_del_vendedor(db, comercio, productos, vendedor):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    comercio_pedidos.cambiar_estado(db, pedido.id, "preparando")
    ventas = vendedor_dashboard.get_mis_ventas(db, vendedor.id)["ventas"]
    assert [(v["canal"], v["id"]) for v in ventas] == [("mayorista", pedido.id)]


def test_entrega_del_vendedor_actualiza_la_venta(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    item = _items_por_producto(pedido)[productos[1].id]
    comercio_pedidos.entregar_item_pedido(db, pedido.id, item.id)
    assert _stock(db, productos[1]) == 46
    venta = comercio_pedidos.venta_de_pedido(db, pedido.id)
    assert {i.product_id: i.delivered_quantity for i in venta.items}[productos[1].id] == 4


def test_autocancelar_vencido_borra_la_venta(db, comercio, productos):
    pedido = _pedido(db, comercio, productos)
    comercio_pedidos.cambiar_estado(db, pedido.id, "confirmado")
    pedido.fecha_reserva_hasta = datetime.utcnow() - timedelta(hours=1)
    db.flush()

    assert comercio_pedidos.autocancelar_vencidos(db) == [pedido.id]
    assert comercio_pedidos.venta_de_pedido(db, pedido.id) is None


def test_reconciliar_stock_cuenta_las_entregas_mayoristas(db, comercio, productos):
    pedido = _pedido(db, comercio, productos, estado="confirmado")
    comercio_pedidos.cambiar_estado(db, pedido.id, "entregado")
    SalesService(db).reconcile_delivered_stock()
    assert _stock(db, productos[0]) == 40
    assert _stock(db, productos[1]) == 46
