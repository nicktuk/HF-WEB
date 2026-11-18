"""Reportes de negocio (services/reportes.py + endpoints /admin/reportes).

Escenario fijo (montos calculables a mano):

Producto P1: lote 10/03 10 u a $1.000, lote 15/06 10 u a $1.500 (4 u salidas).
Producto P2: sin lotes, precio de proveedor $900 (costo actual).
Producto P3: sin lotes ni precio (sin costo).

Ventas minoristas (created_at en UTC):
  S1 2026-04-20 15:00  admin     Vendedora A  "Juan Pérez"   P1 2u x $2.000
  S2 2026-07-20 15:00  vendedor  Vendedora B  " juan  pérez" P1 2u x $2.500
  S3 2026-07-21 15:00  admin     Vendedora A  "Ana"          P2 1u x $1.500, P3 1u x $500, manual 1u x $100
  S4 2026-08-01 02:00  admin     Vendedora A  "Ana"          P2 1u x $1.000   (= 31/07 23:00 en Buenos Aires)
Excluidas: una venta web y una mayorista en julio.
"""
from datetime import date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import settings
from app.core.reports_auth import token_rate_limiter
from app.models.admin_user import AdminUser
from app.models.catalog_seller import CatalogSeller
from app.models.product import Product, ProductDepositStock
from app.models.sale import Sale, SaleItem
from app.models.source_website import SourceWebsite
from app.models.stock import Deposit, StockPurchase
from app.services import reportes as svc

D = Decimal
JULIO = (date(2026, 7, 1), date(2026, 7, 31))
TOKEN = "token-de-prueba-reportes"


def _venta(db, seller, origen, cliente, creada, items, phone=None, delivered=False, paid=False):
    s = Sale(
        customer_name=cliente, seller_id=seller.id, origen=origen, created_at=creada,
        delivered=delivered, paid=paid, phone=phone,
        total_amount=sum(D(q) * D(p) for _, q, p in items),
    )
    db.add(s)
    db.flush()
    for prod, q, p in items:
        db.add(SaleItem(
            sale_id=s.id,
            product_id=prod.id if prod is not None else None,
            manual_product_name=None if prod is not None else "Ítem manual",
            quantity=q, unit_price=D(p), total_price=D(q) * D(p),
        ))
    db.flush()
    return s


@pytest.fixture
def escenario(db):
    web = SourceWebsite(name="web", display_name="Web", base_url="https://example.com")
    db.add(web)
    db.flush()
    va = CatalogSeller(nombre="Vendedora A")
    vb = CatalogSeller(nombre="Vendedora B")
    db.add_all([va, vb])
    db.flush()
    d1 = Deposit(name="Depósito Centro", seller_id=va.id)
    db.add(d1)
    db.flush()

    p1 = Product(source_website_id=web.id, slug="p1", original_name="Pava eléctrica", codigo_interno="HF00001")
    p2 = Product(source_website_id=web.id, slug="p2", original_name="Tostadora", original_price=D("900"))
    p3 = Product(source_website_id=web.id, slug="p3", original_name="Repasador")
    db.add_all([p1, p2, p3])
    db.flush()
    db.add_all([
        StockPurchase(product_id=p1.id, purchase_date=date(2026, 3, 10), unit_price=D("1000"),
                      quantity=10, total_amount=D("10000"), out_quantity=4),
        StockPurchase(product_id=p1.id, purchase_date=date(2026, 6, 15), unit_price=D("1500"),
                      quantity=10, total_amount=D("15000"), out_quantity=0),
        ProductDepositStock(product_id=p1.id, deposit_id=d1.id, quantity=10),
    ])
    db.flush()

    _venta(db, va, "admin", "Juan Pérez", datetime(2026, 4, 20, 15), [(p1, 2, "2000")])
    _venta(db, vb, "vendedor", " juan  pérez", datetime(2026, 7, 20, 15), [(p1, 2, "2500")])
    s3 = _venta(db, va, "admin", "Ana", datetime(2026, 7, 21, 15),
                [(p2, 1, "1500"), (p3, 1, "500"), (None, 1, "100")], phone="1155556666")
    _venta(db, va, "admin", "Ana", datetime(2026, 8, 1, 2), [(p2, 1, "1000")])
    _venta(db, vb, "web", "Cliente web", datetime(2026, 7, 10, 15), [(p1, 1, "9999")])
    _venta(db, vb, "mayorista", "Bazar", datetime(2026, 7, 10, 15), [(p1, 1, "8888")])
    return {"va": va, "vb": vb, "d1": d1, "p1": p1, "p2": p2, "p3": p3, "s3": s3}


def _f(db, desde=JULIO[0], hasta=JULIO[1], **kw):
    return svc.armar_filtros(db, desde, hasta, **kw)


# ─────────────────────────── servicio ───────────────────────────


def test_resumen_kpis_y_margen(db, escenario):
    data = svc.resumen(db, _f(db))
    k = data["kpis"]
    # S2 + S3 + S4 (S4 cae el 31/07 en hora argentina); web y mayorista afuera.
    assert k["ventas"] == 3
    assert k["facturacion"] == D("8100.00")
    assert k["unidades"] == 6
    assert k["ticket_promedio"] == D("2700.00")
    # Costo: S2 2 x 1.250 (promedio de los dos lotes) + P2 2 x 900 (actual).
    assert k["costo"] == D("4300.00")
    assert k["facturacion_con_costo"] == D("7500.00")
    assert k["margen_bruto"] == D("3200.00")
    assert k["margen_pct"] == D("42.7")
    assert k["items_sin_costo"] == 2  # P3 + ítem manual
    assert k["items_costo_actual"] == 2
    assert k["clientes_unicos"] == 2  # "Juan Pérez" y " juan  pérez" son el mismo
    assert k["pct_clientes_repiten"] == D("100.0")
    assert any("sin costo" in a for a in data["advertencias"])
    assert any("costo actual" in a for a in data["advertencias"])


def test_resumen_periodo_anterior(db, escenario):
    data = svc.resumen(db, _f(db))
    assert data["periodo_anterior"] == {"desde": "2026-05-31", "hasta": "2026-06-30"}
    assert data["anterior"]["facturacion"] == D("0.00")
    assert data["variacion"]["facturacion"] is None  # sin base, no hay %
    # Abril contra marzo: hay base en el período actual, no en el anterior.
    abril = svc.resumen(db, _f(db, date(2026, 4, 1), date(2026, 4, 30)))
    assert abril["kpis"]["facturacion"] == D("4000.00")
    assert abril["kpis"]["margen_bruto"] == D("2000.00")  # solo existía el lote a $1.000
    assert len(abril["serie"]) == 30


def test_zona_horaria_buenos_aires(db, escenario):
    agosto = svc.resumen(db, _f(db, date(2026, 8, 1), date(2026, 8, 1)))
    assert agosto["kpis"]["ventas"] == 0
    dia31 = svc.resumen(db, _f(db, date(2026, 7, 31), date(2026, 7, 31)))
    assert dia31["kpis"]["facturacion"] == D("1000.00")


def test_venta_borrada_no_cuenta(db, escenario):
    db.delete(escenario["s3"])
    db.flush()
    k = svc.resumen(db, _f(db))["kpis"]
    assert k["ventas"] == 2
    assert k["facturacion"] == D("6000.00")


def test_filtros_canal_vendedora_estado_deposito(db, escenario):
    assert svc.resumen(db, _f(db, canal="vendedor"))["kpis"]["facturacion"] == D("5000.00")
    assert svc.resumen(db, _f(db, vendedora_id=escenario["va"].id))["kpis"]["facturacion"] == D("3100.00")
    escenario["s3"].delivered = True
    db.flush()
    assert svc.resumen(db, _f(db, estado="entregadas"))["kpis"]["facturacion"] == D("2100.00")
    assert svc.resumen(db, _f(db, estado="cobradas"))["kpis"]["ventas"] == 0
    # Depósito de la vendedora A (sus ítems todavía no se entregaron).
    dep = svc.resumen(db, _f(db, deposito_id=escenario["d1"].id))["kpis"]
    assert dep["facturacion"] == D("3100.00")


def test_filtros_invalidos(db, escenario):
    from app.core.exceptions import ValidationError
    with pytest.raises(ValidationError):
        svc.armar_filtros(db, date(2026, 8, 1), date(2026, 7, 1))
    with pytest.raises(ValidationError):
        svc.armar_filtros(db, date(2026, 7, 1), date(2026, 7, 2), canal="web")


def test_ventas_serie_por_canal(db, escenario):
    data = svc.ventas(db, _f(db, agrupar="semana"))
    assert data["agrupar"] == "semana"
    assert data["total"]["facturacion"] == D("8100.00")
    semana_20 = next(s for s in data["serie"] if s["periodo"] == "2026-07-20")
    assert semana_20["por_canal"]["vendedor"]["facturacion"] == D("5000.00")
    assert semana_20["por_canal"]["admin"]["facturacion"] == D("2100.00")
    mes = svc.ventas(db, _f(db, agrupar="mes"))
    assert [s["periodo"] for s in mes["serie"]] == ["2026-07-01"]


def test_productos_margen_con_y_sin_costo(db, escenario):
    data = svc.productos(db, _f(db))
    por_id = {p["product_id"]: p for p in data["productos"]}
    p1 = por_id[escenario["p1"].id]
    assert p1["facturacion"] == D("5000.00")
    assert p1["costo"] == D("2500.00")
    assert p1["margen"] == D("2500.00")
    assert p1["margen_pct"] == D("50.0")
    assert p1["stock"] == 16
    assert p1["dias_cobertura"] == D("248.0")  # 16 / (2 / 31)
    assert p1["ultima_venta"] == "2026-07-20"
    p2 = por_id[escenario["p2"].id]
    assert p2["margen"] == D("700.00") and p2["costo_actual"] is True
    p3 = por_id[escenario["p3"].id]
    assert p3["margen"] is None and p3["costo"] is None  # no se inventa costo
    assert data["items_sin_costo"] == 2
    assert data["items_manuales"]["items"] == 1
    # Orden, top y bottom; los sin margen quedan al final.
    assert [p["product_id"] for p in data["productos"]][0] == escenario["p1"].id
    top1 = svc.productos(db, _f(db), orden="margen", top=1)
    assert len(top1["productos"]) == 1 and top1["productos"][0]["product_id"] == escenario["p1"].id
    bottom = svc.productos(db, _f(db), orden="margen", bottom=3)
    assert bottom["productos"][0]["product_id"] == escenario["p2"].id
    assert bottom["productos"][-1]["margen"] is None


def test_stock_inmovilizado(db, escenario):
    data = svc.stock_inmovilizado(db, dias_min=0)
    p1 = [i for i in data["items"] if i["product_id"] == escenario["p1"].id]
    centro = next(i for i in p1 if i["deposito_id"] == escenario["d1"].id)
    sin_asignar = next(i for i in p1 if i["deposito_id"] is None)
    # Quedan 6 u del lote a $1.000 y 10 u del lote a $1.500: promedio $1.312,50.
    assert centro["stock"] == 10 and centro["valor_costo"] == D("13125.00")
    assert sin_asignar["stock"] == 6 and sin_asignar["valor_costo"] == D("7875.00")
    assert centro["ultima_venta"] == "2026-07-20"  # cualquier canal: la web del 10/07 es anterior
    assert data["total_valor_costo"] == D("21000.00")
    # dias_min alto: nada parado.
    assert svc.stock_inmovilizado(db, dias_min=100000)["items"] == []
    # Filtro por depósito.
    solo = svc.stock_inmovilizado(db, deposito_id=escenario["d1"].id, dias_min=0)
    assert solo["total_valor_costo"] == D("13125.00")


def test_vendedoras(db, escenario):
    data = svc.vendedoras(db, _f(db))
    por_id = {v["vendedora_id"]: v for v in data["vendedoras"]}
    a = por_id[escenario["va"].id]
    assert a["ventas"] == 2 and a["facturacion"] == D("3100.00") and a["ticket_promedio"] == D("1550.00")
    assert a["margen"] == D("700.00") and a["items_sin_costo"] == 2
    assert a["base_comisionable"] is None
    assert por_id[escenario["vb"].id]["margen"] == D("2500.00")


def test_clientes(db, escenario):
    data = svc.clientes(db, _f(db), datos_personales=True)
    assert data["kpis"]["clientes_unicos"] == 2
    juan = next(c for c in data["clientes"] if "juan" in c["nombre"].lower())
    assert juan["compras_totales"] == 2
    assert juan["primera_compra"] == "2026-04-20" and juan["ultima_compra"] == "2026-07-20"
    assert juan["dias_promedio_entre_compras"] == D("91.0")
    ana = next(c for c in data["clientes"] if c["nombre"] == "Ana")
    assert ana["telefono"] == "1155556666"
    sin_datos = svc.clientes(db, _f(db), datos_personales=False)
    assert all("telefono" not in c and "email" not in c for c in sin_datos["clientes"])
    abril = svc.clientes(db, _f(db, date(2026, 4, 1), date(2026, 4, 30)), datos_personales=False, solo_una_compra=True)
    assert len(abril["clientes"]) == 1  # en abril Juan llevaba una sola compra


# ─────────────────────────── endpoints y auth ───────────────────────────


@pytest.fixture
def client(db, escenario, monkeypatch):
    from app.main import app
    from app.db.session import get_db
    from app.db.reportes_session import get_reportes_db

    db.add_all([
        AdminUser(name="Super", api_key="k-super", role="superadmin"),
        AdminUser(name="Editor", api_key="k-editor", role="product_editor"),
    ])
    db.flush()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_reportes_db] = lambda: db
    monkeypatch.setattr(settings, "REPORTS_API_TOKEN", TOKEN)
    monkeypatch.setattr(settings, "REPORTS_RATE_LIMIT_PER_MIN", 1000)
    token_rate_limiter.reset()
    yield TestClient(app)
    app.dependency_overrides.clear()
    token_rate_limiter.reset()


URL = "/api/v1/admin/reportes"
Q = "desde=2026-07-01&hasta=2026-07-31"
ENDPOINTS = ["resumen", "ventas", "productos", "stock-inmovilizado", "vendedoras", "clientes"]


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_endpoint_admin_ok(client, endpoint):
    r = client.get(f"{URL}/{endpoint}?{Q}", headers={"X-Admin-API-Key": "k-super"})
    assert r.status_code == 200, r.text
    assert "advertencias" in r.json()


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_endpoint_csv(client, endpoint):
    r = client.get(f"{URL}/{endpoint}?{Q}&formato=csv", headers={"X-Reports-Token": TOKEN})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]


def test_montos_como_decimal_string(client):
    r = client.get(f"{URL}/resumen?{Q}", headers={"X-Admin-API-Key": "k-super"})
    assert r.json()["kpis"]["facturacion"] == "8100.00"


def test_auth_token_header_y_query(client):
    assert client.get(f"{URL}/resumen?{Q}", headers={"X-Reports-Token": TOKEN}).status_code == 200
    assert client.get(f"{URL}/resumen?{Q}&token={TOKEN}").status_code == 200


def test_auth_invalida(client):
    assert client.get(f"{URL}/resumen?{Q}").status_code == 401
    assert client.get(f"{URL}/resumen?{Q}&token=otro").status_code == 401
    assert client.get(f"{URL}/resumen?{Q}", headers={"X-Admin-API-Key": "nope"}).status_code == 401
    # Rol sin permisos de admin completo.
    assert client.get(f"{URL}/resumen?{Q}", headers={"X-Admin-API-Key": "k-editor"}).status_code == 403


def test_token_deshabilitado(client, monkeypatch):
    monkeypatch.setattr(settings, "REPORTS_API_TOKEN", "")
    assert client.get(f"{URL}/resumen?{Q}&token=").status_code == 401
    assert client.get(f"{URL}/resumen?{Q}", headers={"X-Reports-Token": "x"}).status_code == 401


def test_token_no_sirve_fuera_de_reportes(client):
    for path in ("/api/v1/admin/me", "/api/v1/admin/sales", "/api/v1/admin/stats/financials"):
        r1 = client.get(path, headers={"X-Reports-Token": TOKEN})
        r2 = client.get(f"{path}?token={TOKEN}")
        assert r1.status_code in (401, 403), path
        assert r2.status_code in (401, 403), path


def test_token_sin_datos_personales(client):
    por_token = client.get(f"{URL}/clientes?{Q}&token={TOKEN}").json()
    assert all("telefono" not in c and "email" not in c for c in por_token["clientes"])
    por_admin = client.get(f"{URL}/clientes?{Q}", headers={"X-Admin-API-Key": "k-super"}).json()
    assert any(c.get("telefono") == "1155556666" for c in por_admin["clientes"])


def test_rate_limit_token(client, monkeypatch):
    monkeypatch.setattr(settings, "REPORTS_RATE_LIMIT_PER_MIN", 3)
    codes = [client.get(f"{URL}/ventas?{Q}&token={TOKEN}").status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    # El admin no consume el cupo del token.
    assert client.get(f"{URL}/ventas?{Q}", headers={"X-Admin-API-Key": "k-super"}).status_code == 200


def test_parametros_invalidos(client):
    h = {"X-Admin-API-Key": "k-super"}
    assert client.get(f"{URL}/resumen?desde=2026-08-01&hasta=2026-07-01", headers=h).status_code == 422
    assert client.get(f"{URL}/resumen?{Q}&canal=web", headers=h).status_code == 422
    assert client.get(f"{URL}/productos?{Q}&orden=cualquiera", headers=h).status_code == 422


# ─────────────────────────── conexión de solo lectura ───────────────────────────


def test_conexion_solo_lectura_y_timeout(engine, monkeypatch):
    from app.db import reportes_session

    monkeypatch.setattr(settings, "REPORTS_DATABASE_URL", "")
    monkeypatch.setattr(reportes_session, "main_engine", engine)
    gen = reportes_session.get_reportes_db()
    conn = next(gen)
    try:
        assert conn.execute(text("SHOW transaction_read_only")).scalar() == "on"
        assert conn.execute(text("SHOW statement_timeout")).scalar() == "15s"
        with pytest.raises(Exception) as exc:
            conn.execute(text("CREATE TEMP TABLE x (id int)"))
        assert "read-only" in str(exc.value)
    finally:
        gen.close()
