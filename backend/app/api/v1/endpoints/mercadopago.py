"""Mercado Pago Wallet Brick integration endpoints.

Flow: the frontend creates a preference (and a pending order tied to it via
external_reference), redirects the buyer to MP's hosted checkout, and MP
notifies the backend via webhook when the payment is confirmed. The Sale is
only created once the webhook confirms an approved/pending payment — never
client-side — so a buyer closing the tab after paying can't skip it, and a
buyer poking the API directly can't create a Sale without actually paying.
"""
import uuid
import logging
from decimal import Decimal
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.config import settings
from app.core.exceptions import ValidationError
from app.models.product import Product
from app.models.mp_pending_order import MpPendingOrder
from app.schemas.sales import PublicOrderCreate, PublicOrderItemCreate
from app.services.app_settings import get_setting, get_shipping_config, SHIPPING_ZONE_LABELS
from app.services.sales import SalesService

router = APIRouter()
logger = logging.getLogger(__name__)

MP_API_BASE = "https://api.mercadopago.com"


def _get_mp_credentials(db: Session) -> tuple[str, str]:
    access_token = get_setting(db, "MP_ACCESS_TOKEN") or settings.MP_ACCESS_TOKEN
    public_key = get_setting(db, "MP_PUBLIC_KEY") or settings.MP_PUBLIC_KEY
    return access_token, public_key


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class MPPreferenceCartItem(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    color: Optional[str] = None
    is_card_payment: bool = False


class MPPreferenceRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., min_length=6, max_length=50)
    email: Optional[str] = None
    notes: Optional[str] = None
    delivery_method: Optional[Literal["pickup", "shipping", "agreement"]] = None
    shipping_zone: Optional[Literal["amba", "resto_pais"]] = None
    items: List[MPPreferenceCartItem]


class MPPreferenceResponse(BaseModel):
    preference_id: str
    public_key: str
    amount: float
    checkout_url: str


class MPOrderStatusResponse(BaseModel):
    status: str
    sale_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _calculate_total(
    db: Session,
    items: List[MPPreferenceCartItem],
    delivery_method: Optional[str] = None,
    shipping_zone: Optional[str] = None,
) -> tuple[float, list]:
    """
    Fetches product prices from DB and returns (total, items_payload).
    items_payload is ready for the MP preference API.
    Envío: costo y mínimo se recalculan server-side, nunca se confía en el cliente.
    """
    total = Decimal("0")
    items_payload = []

    for item in items:
        product = db.query(Product).filter(Product.id == item.product_id, Product.enabled == True).first()
        if not product:
            raise HTTPException(status_code=422, detail=f"Producto {item.product_id} no encontrado")

        # Determine unit price (card installment price × 3 or base price)
        if item.is_card_payment and product.installments_3 and product.installment_price:
            unit_price = Decimal(str(product.installment_price)) * 3
        else:
            if product.final_price is None:
                raise HTTPException(status_code=422, detail=f"Producto {item.product_id} sin precio")
            unit_price = Decimal(str(product.final_price))

        total += unit_price * item.quantity
        items_payload.append({
            "id": str(item.product_id),
            "title": product.display_name,
            "quantity": item.quantity,
            "unit_price": float(unit_price),
            "currency_id": "ARS",
        })

    if delivery_method == "shipping":
        shipping_config = get_shipping_config(db)
        min_purchase = Decimal(str(shipping_config["min_purchase"]))
        if total < min_purchase:
            raise ValidationError(
                f"El pedido no alcanza el mínimo de compra para envío (${min_purchase})"
            )
        if shipping_zone not in ("amba", "resto_pais"):
            raise ValidationError("Debés indicar la zona de envío (AMBA o Resto del país)")
        shipping_cost = Decimal(str(shipping_config[shipping_zone])).quantize(Decimal("0.01"))
        if shipping_cost > 0:
            total += shipping_cost
            items_payload.append({
                "id": "shipping",
                "title": f"Envío ({SHIPPING_ZONE_LABELS.get(shipping_zone, shipping_zone)})",
                "quantity": 1,
                "unit_price": float(shipping_cost),
                "currency_id": "ARS",
            })

    return float(total), items_payload


# ---------------------------------------------------------------------------
# POST /mp/preference
# ---------------------------------------------------------------------------

@router.post("/mp/preference", response_model=MPPreferenceResponse)
async def create_mp_preference(
    data: MPPreferenceRequest,
    db: Session = Depends(get_db),
):
    """Creates a MP preference + a pending order the webhook will complete once MP confirms payment."""
    access_token, public_key = _get_mp_credentials(db)
    if not access_token or not public_key:
        raise HTTPException(status_code=503, detail="Mercado Pago no está configurado")

    total, items_payload = _calculate_total(db, data.items, data.delivery_method, data.shipping_zone)

    external_reference = str(uuid.uuid4())

    pending_order = MpPendingOrder(
        id=external_reference,
        name=data.name,
        phone=data.phone,
        email=data.email,
        notes=data.notes,
        delivery_method=data.delivery_method,
        shipping_zone=data.shipping_zone,
        items=[item.model_dump() for item in data.items],
        amount=total,
        status="pending",
    )
    db.add(pending_order)
    db.commit()

    payer: dict = {"name": data.name}
    if data.email:
        payer["email"] = data.email

    notification_url = f"{settings.PROD_BACKEND_URL}/api/v1/public/mp/webhook"
    return_url = f"{settings.NEXT_PUBLIC_BASE_URL}/pago/resultado?ref={external_reference}"

    preference_payload = {
        "items": items_payload,
        "payer": payer,
        "external_reference": external_reference,
        "notification_url": notification_url,
        "back_urls": {
            "success": return_url,
            "pending": return_url,
            "failure": return_url,
        },
        "auto_return": "approved",
        "binary_mode": True,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{MP_API_BASE}/checkout/preferences",
                json=preference_payload,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            pref_data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("MP preference error: %s — %s", exc.response.status_code, exc.response.text)
        raise HTTPException(status_code=502, detail="Error al crear preferencia de pago")
    except httpx.RequestError as exc:
        logger.error("MP connection error: %s", exc)
        raise HTTPException(status_code=502, detail="Error de conexión con Mercado Pago")

    # Con credenciales TEST, MP sólo acepta el checkout en su URL de sandbox.
    is_test = access_token.startswith("TEST-")
    checkout_url = (
        (pref_data.get("sandbox_init_point") if is_test else pref_data.get("init_point"))
        or pref_data.get("init_point")
        or pref_data.get("sandbox_init_point")
    )

    return MPPreferenceResponse(
        preference_id=pref_data["id"],
        public_key=public_key,
        amount=total,
        checkout_url=checkout_url,
    )


# ---------------------------------------------------------------------------
# GET /mp/order-status/{ref}
# ---------------------------------------------------------------------------

@router.get("/mp/order-status/{external_reference}", response_model=MPOrderStatusResponse)
async def get_mp_order_status(external_reference: str, db: Session = Depends(get_db)):
    """Polled by the return page to know whether the webhook already confirmed the payment."""
    pending_order = db.query(MpPendingOrder).filter(MpPendingOrder.id == external_reference).first()
    if not pending_order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    return MPOrderStatusResponse(status=pending_order.status, sale_id=pending_order.sale_id)


# ---------------------------------------------------------------------------
# POST /mp/webhook
# ---------------------------------------------------------------------------

@router.post("/mp/webhook")
async def mp_webhook(request: Request, db: Session = Depends(get_db)):
    """Receives MP payment notifications and creates the Sale once payment is confirmed."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    topic = body.get("type") or request.query_params.get("topic", "")
    resource_id = body.get("data", {}).get("id") or request.query_params.get("id")

    logger.info("MP webhook: topic=%s id=%s", topic, resource_id)

    if topic != "payment" or not resource_id:
        return {"status": "ok"}

    access_token, _ = _get_mp_credentials(db)
    if not access_token:
        return {"status": "ok"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{MP_API_BASE}/v1/payments/{resource_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if not resp.is_success:
                logger.warning("MP webhook: payment %s fetch failed (%s)", resource_id, resp.status_code)
                return {"status": "ok"}
            payment_data = resp.json()
    except Exception as exc:
        logger.warning("MP webhook fetch failed: %s", exc)
        return {"status": "ok"}

    payment_status = payment_data.get("status")
    external_reference = payment_data.get("external_reference")
    logger.info("MP webhook payment %s status=%s ref=%s", resource_id, payment_status, external_reference)

    if not external_reference:
        return {"status": "ok"}

    pending_order = db.query(MpPendingOrder).filter(MpPendingOrder.id == external_reference).first()
    if not pending_order:
        logger.warning("MP webhook: no pending order for ref=%s", external_reference)
        return {"status": "ok"}

    if pending_order.status == "completed":
        # Already processed (MP can resend the same notification).
        return {"status": "ok"}

    if payment_status in ("rejected", "cancelled"):
        pending_order.status = "failed"
        pending_order.mp_payment_id = str(resource_id)
        db.commit()
        return {"status": "ok"}

    if payment_status not in ("approved", "pending", "in_process"):
        return {"status": "ok"}

    items = [MPPreferenceCartItem(**item) for item in pending_order.items]
    real_total, _ = _calculate_total(db, items, pending_order.delivery_method, pending_order.shipping_zone)
    paid_amount = round(float(payment_data.get("transaction_amount") or 0), 2)
    if abs(paid_amount - round(real_total, 2)) > 1.0:
        logger.error(
            "MP webhook amount mismatch ref=%s: paid %.2f vs expected %.2f",
            external_reference, paid_amount, real_total,
        )
        pending_order.status = "failed"
        db.commit()
        return {"status": "ok"}

    payment_method_id = payment_data.get("payment_method_id", "")
    order_data = PublicOrderCreate(
        name=pending_order.name,
        phone=pending_order.phone,
        email=pending_order.email,
        payment_method=f"Mercado Pago ({payment_method_id})",
        is_card_payment=True,
        notes=pending_order.notes,
        delivery_method=pending_order.delivery_method,
        shipping_zone=pending_order.shipping_zone,
        items=[
            PublicOrderItemCreate(
                product_id=i.product_id,
                quantity=i.quantity,
                color=i.color,
                is_card_payment=i.is_card_payment,
            )
            for i in items
        ],
    )
    sale = SalesService(db).create_public_order(order_data)

    pending_order.status = "completed"
    pending_order.sale_id = sale.id
    pending_order.mp_payment_id = str(resource_id)
    db.commit()

    return {"status": "ok"}
