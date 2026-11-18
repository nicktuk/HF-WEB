"""Cobranza y ciclo de vida de las ventas (services/reportes.py: ciclo, caja,
cobranza en resumen/ventas/vendedoras).

Corte de fechas reales: el historial de estados se cargó el 18/09/2026 12:00 UTC.
"Hoy" fijo: 18/11/2026.

Ventas minoristas (fechas de entrega/cobro en UTC, 15:00 = 12:00 en Buenos Aires):
  V1 05/08  $1.000  entregada 10/10, cobrada 20/10          -> 66 / 76 / 10 días
  V2 10/08  $2.000  entregada 12/08 (aprox.), cobrada 01/10 -> solo venta→cobro (52)
  V3 01/10  $500    entregada y cobrada 03/10               -> 2 / 2 / 0
  V4 05/10  $800    entregada 06/10, sin cobrar             -> por cobrar $800 (43 días)
  V5 07/10  $1.200  entregada 08/10, 2 cuotas de $600, 1 paga el 15/10
                                                           -> cobrado $600, por cobrar $600 (41 días)
  V6 09/10  $300    sin entregar ni cobrar                  -> por entregar $300 (40 días)
"""
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.models.admin_user import AdminUser
from app.models.catalog_seller import CatalogSeller
from app.models.comercio import EstadoHistorial
from app.models.product import Product
from app.models.sale import Sale, SaleInstallment, SaleItem
from app.models.source_website import SourceWebsite
from app.services import reportes as svc

D = Decimal


def utc(y, m, d, h=15):
    return datetime(y, m, d, h, tzinfo=timezone.utc)


def _venta(db, seller, prod, creada, monto, entregada=None, cobrada=None, cuotas=None):
    monto = D(monto)
    s = Sale(
        customer_name="Cliente", seller_id=seller.id, origen="admin",
        created_at=creada.replace(tzinfo=None),
        total_amount=monto,
        delivered=entregada is not None,
        delivered_amount=monto if entregada else D(0),
        paid=cobrada is not None,
        paid_amount=monto if cobrada else D(0),
    )
    db.add(s)
    db.flush()
    db.add(SaleItem(
        sale_id=s.id, product_id=prod.id, quantity=1, unit_price=monto, total_price=monto,
        delivered_quantity=1 if entregada else 0, delivered_at=entregada,
        is_paid=cobrada is not None and not cuotas, paid_at=cobrada if not cuotas else None,
    ))
    if cuotas:
        pagado = D(0)
        for i, (importe, fecha_pago) in enumerate(cuotas, 1):
            db.add(SaleInstallment(sale_id=s.id, number=i, amount=D(importe),
                                   paid=fecha_pago is not None, paid_at=fecha_pago))
            if fecha_pago:
                pagado += D(importe)
        s.paid_amount = pagado
        s.paid = pagado == monto
    db.flush()
    return s


@pytest.fixture
def escenario(db, monkeypatch):
    monkeypatch.setattr(svc, "hoy_local", lambda conn: date(2026, 11, 18))
    db.add(EstadoHistorial(canal="minorista", referencia_id=0, estado="pagada",
                           fecha=datetime(2026, 1, 1), created_at=datetime(2026, 9, 18, 12)))
    web = SourceWebsite(name="web", display_name="Web", base_url="https://example.com")
    db.add(web)
    db.flush()
    va = CatalogSeller(nombre="Vendedora A")
    db.add(va)
    db.flush()
    p = Product(source_website_id=web.id, slug="p", original_name="Producto", original_price=D("100"))
    db.add(p)
    db.flush()
    v = {
        "v1": _venta(db, va, p, utc(2026, 8, 5), "1000", utc(2026, 10, 10), utc(2026, 10, 20)),
        "v2": _venta(db, va, p, utc(2026, 8, 10), "2000", utc(2026, 8, 12), utc(2026, 10, 1)),
        "v3": _venta(db, va, p, utc(2026, 10, 1), "500", utc(2026, 10, 3), utc(2026, 10, 3)),
        "v4": _venta(db, va, p, utc(2026, 10, 5), "800", utc(2026, 10, 6)),
        "v5": _venta(db, va, p, utc(2026, 10, 7), "1200", utc(2026, 10, 8),
                     cuotas=[("600", utc(2026, 10, 15)), ("600", None)]),
        "v6": _venta(db, va, p, utc(2026, 10, 9), "300"),
    }
    return {"va": va, "p": p, **v}


def _f(db, desde=date(2026, 8, 1), hasta=date(2026, 10, 31)):
    return svc.armar_filtros(db, desde, hasta)


def test_corte_de_fechas_desde_el_historial(db, escenario):
    assert svc._corte_local(svc.corte_fechas(db)) == date(2026, 9, 18)


def test_tiempos_usan_solo_fechas_reales(db, escenario):
    data = svc.ciclo(db, _f(db))
    assert data["fechas_reales_desde"] == "2026-09-18"
    t = data["tiempos"]
    # Venta→entrega: V1 66, V3 2, V4 1, V5 1 (la entrega de V2 es aproximada).
    assert t["venta_entrega"] == {"promedio": D("17.5"), "mediana": D("1.5"), "ventas": 4}
    # Venta→cobro: V1 76, V2 52 (venta de agosto cobrada en octubre: dato real), V3 2.
    assert t["venta_cobro"] == {"promedio": D("43.3"), "mediana": D("52.0"), "ventas": 3}
    # Entrega→cobro: V1 10, V3 0.
    assert t["entrega_cobro"] == {"promedio": D("5.0"), "mediana": D("5.0"), "ventas": 2}
    dist = {d["rango"]: d["ventas"] for d in data["distribucion_entrega_cobro"]}
    assert dist == {"Mismo día": 1, "1–7 días": 0, "8–30 días": 1, "Más de 30 días": 0}
    assert data["cobradas_antes_de_entregar"] == 0
    assert any("18/09/2026" in a for a in data["advertencias"])


def test_cobranza_de_las_ventas_del_periodo(db, escenario):
    c = svc.ciclo(db, _f(db))["cobranza"]
    assert c["facturacion"] == D("5800.00")
    # V1 + V2 + V3 + la cuota pagada de V5.
    assert c["cobrado"] == D("4100.00")
    assert c["pct_cobranza"] == D("70.7")
    assert c["pendiente"] == D("1700.00")
    agosto = svc.ciclo(db, _f(db, date(2026, 8, 1), date(2026, 8, 31)))["cobranza"]
    assert agosto["pct_cobranza"] == D("100.0")


def test_plata_que_entro_en_el_periodo(db, escenario):
    corte = svc.corte_fechas(db)
    octubre = svc.caja(db, _f(db, date(2026, 10, 1), date(2026, 10, 31)), corte)
    # Entra lo cobrado en octubre aunque la venta sea de agosto (V1, V2).
    assert octubre["total"] == D("4100.00")
    assert octubre["pagos"] == 4
    assert octubre["pagos_fecha_aproximada"] == 0
    agosto = svc.caja(db, _f(db, date(2026, 8, 1), date(2026, 8, 31)), corte)
    assert agosto["total"] == D("0.00")


def test_pendientes_por_antiguedad(db, escenario):
    data = svc.ciclo(db, _f(db))
    pc = data["por_cobrar"]
    assert pc["total"] == D("1400.00") and pc["ventas"] == 2  # V4 $800 + V5 $600
    assert {a["rango"]: a["monto"] for a in pc["antiguedad"]}["31–60 días"] == D("1400.00")
    pe = data["por_entregar"]
    assert pe["total"] == D("300.00")
    det = {d["venta_id"]: d for d in data["pendientes"]}
    assert det[escenario["v4"].id]["dias_desde_entrega"] == 43
    assert det[escenario["v6"].id]["dias_desde_venta"] == 40
    assert data["por_vendedora"][0]["por_cobrar"] == D("1400.00")


def test_entrega_anterior_al_corte_va_a_sin_fecha_real(db, escenario):
    _venta(db, escenario["va"], escenario["p"], utc(2026, 7, 1), "700", utc(2026, 7, 2))
    pc = svc.ciclo(db, _f(db))["por_cobrar"]
    rangos = {a["rango"]: a["monto"] for a in pc["antiguedad"]}
    assert rangos[svc.SIN_FECHA_REAL] == D("700.00")


def test_cobro_antes_de_entrega_no_entra_en_el_promedio(db, escenario):
    _venta(db, escenario["va"], escenario["p"], utc(2026, 10, 12), "400", utc(2026, 10, 20), utc(2026, 10, 15))
    data = svc.ciclo(db, _f(db))
    assert data["cobradas_antes_de_entregar"] == 1
    assert data["tiempos"]["entrega_cobro"]["ventas"] == 2  # sigue siendo V1 y V3
    assert any("antes de entregarse" in a for a in data["advertencias"])


def test_sin_historial_todas_las_fechas_son_reales(db, escenario):
    db.query(EstadoHistorial).delete()
    db.flush()
    t = svc.ciclo(db, _f(db))["tiempos"]
    assert t["venta_entrega"]["ventas"] == 5  # ahora también cuenta V2 (2 días)


def test_resumen_ventas_y_vendedoras_con_cobranza(db, escenario):
    r = svc.resumen(db, _f(db, date(2026, 10, 1), date(2026, 10, 31)))
    k = r["kpis"]
    assert k["facturacion"] == D("2800.00")
    assert k["cobrado"] == D("1100.00")  # V3 + cuota de V5
    assert k["pct_cobranza"] == D("39.3")
    assert k["cobrado_en_periodo"] == D("4100.00")
    assert k["dias_entrega_cobro"] == D("0.0")  # solo V3 de las ventas de octubre
    assert r["anterior"]["cobrado_en_periodo"] == D("0.00")
    v = svc.ventas(db, _f(db, date(2026, 10, 1), date(2026, 10, 31)))
    assert v["total"]["cobrado"] == D("1100.00") and v["total"]["pct_cobranza"] == D("39.3")
    vend = svc.vendedoras(db, _f(db))["vendedoras"][0]
    assert vend["pct_cobranza"] == D("70.7")
    assert vend["dias_entrega_cobro"] == D("5.0")


def test_endpoint_ciclo(db, escenario):
    from app.main import app
    from app.db.session import get_db
    from app.db.reportes_session import get_reportes_db

    db.add(AdminUser(name="Super", api_key="k-super", role="superadmin"))
    db.flush()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_reportes_db] = lambda: db
    try:
        c = TestClient(app)
        h = {"X-Admin-API-Key": "k-super"}
        r = c.get("/api/v1/admin/reportes/ciclo?desde=2026-08-01&hasta=2026-10-31", headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["cobranza"]["cobrado"] == "4100.00"
        csv = c.get("/api/v1/admin/reportes/ciclo?desde=2026-08-01&hasta=2026-10-31&formato=csv", headers=h)
        assert csv.status_code == 200 and "por_cobrar" in csv.text
        assert c.get("/api/v1/admin/reportes/ciclo").status_code == 401
    finally:
        app.dependency_overrides.clear()
