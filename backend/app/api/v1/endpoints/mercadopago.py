"""Mercado Pago Checkout Bricks integration endpoints."""
import uuid
import logging
from decimal import Decimal
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.config import settings
from app.models.product import Product
from app.schemas.sales import PublicOrderCreate, PublicOrderItemCreate
from app.services.app_settings import get_setting
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
    name: str
    email: Optional[str] = None
    items: List[MPPreferenceCartItem]


class MPPreferenceResponse(BaseModel):
    preference_id: str
    public_key: str
    amount: float


class MPPayerIdentification(BaseModel):
    type: Optional[str] = None
    number: Optional[str] = None


class MPPayer(BaseModel):
    email: Optional[str] = None
    identification: Optional[MPPayerIdentification] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class MPFormData(BaseModel):
    token: Optional[str] = None
    payment_method_id: Optional[str] = None
    transaction_amount: float
    installments: Optional[int] = None
    issuer_id: Optional[str] = None
    payer: Optional[MPPayer] = None
    payment_type_id: Optional[str] = None


class MPProcessPaymentRequest(BaseModel):
    form_data: MPFormData
    name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., min_length=6, max_length=50)
    email: Optional[str] = None
    notes: Optional[str] = None
    items: List[MPPreferenceCartItem]


class MPProcessPaymentResponse(BaseModel):
    status: str
    sale_id: Optional[int] = None
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _calculate_total(db: Session, items: List[MPPreferenceCartItem]) -> tuple[float, list]:
    """
    Fetches product prices from DB and returns (total, items_payload).
    items_payload is ready for the MP preference API.
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
            if product.price is None:
                raise HTTPException(status_code=422, detail=f"Producto {item.product_id} sin precio")
            unit_price = Decimal(str(product.price))

        total += unit_price * item.quantity
        items_payload.append({
            "id": str(item.product_id),
            "title": product.custom_name or product.original_name or product.name,
            "quantity": item.quantity,
            "unit_price": float(unit_price),
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
    """Creates a MP preference for the Wallet (account money) Brick option."""
    access_token, public_key = _get_mp_credentials(db)
    if not access_token or not public_key:
        raise HTTPException(status_code=503, detail="Mercado Pago no está configurado")

    total, items_payload = _calculate_total(db, data.items)

    payer: dict = {"name": data.name}
    if data.email:
        payer["email"] = data.email

    notification_url = f"{settings.PROD_BACKEND_URL}/api/v1/public/mp/webhook"

    preference_payload = {
        "items": items_payload,
        "payer": payer,
        "notification_url": notification_url,
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

    return MPPreferenceResponse(
        preference_id=pref_data["id"],
        public_key=public_key,
        amount=total,
    )


# ---------------------------------------------------------------------------
# POST /mp/process-payment
# ---------------------------------------------------------------------------

@router.post("/mp/process-payment", response_model=MPProcessPaymentResponse)
async def process_mp_payment(
    data: MPProcessPaymentRequest,
    db: Session = Depends(get_db),
):
    """Processes a payment from the Payment Brick formData and creates a sale on success."""
    access_token, _ = _get_mp_credentials(db)
    if not access_token:
        raise HTTPException(status_code=503, detail="Mercado Pago no está configurado")

    # Calculate real total from DB — never trust client-provided amount
    real_total, _ = _calculate_total(db, data.items)
    provided_amount = round(data.form_data.transaction_amount, 2)
    if abs(provided_amount - round(real_total, 2)) > 1.0:
        logger.warning("MP amount mismatch: provided %.2f vs real %.2f", provided_amount, real_total)
        raise HTTPException(status_code=422, detail="El monto del pago no coincide con el total del carrito")

    # Build payment payload
    payer_email = (
        (data.form_data.payer.email if data.form_data.payer else None)
        or data.email
        or ""
    )
    payment_payload: dict = {
        "transaction_amount": real_total,
        "payment_method_id": data.form_data.payment_method_id,
        "installments": data.form_data.installments or 1,
        "payer": {"email": payer_email},
    }

    if data.form_data.token:
        payment_payload["token"] = data.form_data.token

    if data.form_data.issuer_id:
        payment_payload["issuer_id"] = data.form_data.issuer_id

    if data.form_data.payer:
        p = data.form_data.payer
        if p.identification and p.identification.type and p.identification.number:
            payment_payload["payer"]["identification"] = {
                "type": p.identification.type,
                "number": p.identification.number,
            }
        if p.first_name:
            payment_payload["payer"]["first_name"] = p.first_name
        if p.last_name:
            payment_payload["payer"]["last_name"] = p.last_name

    idempotency_key = str(uuid.uuid4())

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{MP_API_BASE}/v1/payments",
                json=payment_payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Idempotency-Key": idempotency_key,
                },
            )
            mp_data = resp.json()
    except httpx.RequestError as exc:
        logger.error("MP payment connection error: %s", exc)
        raise HTTPException(status_code=502, detail="Error de conexión con Mercado Pago")

    payment_status = mp_data.get("status", "rejected")
    payment_method_id = mp_data.get("payment_method_id", "")
    mp_payment_id = mp_data.get("id")

    logger.info("MP payment %s — status: %s", mp_payment_id, payment_status)

    if payment_status in ("approved", "pending", "in_process"):
        service = SalesService(db)
        order_data = PublicOrderCreate(
            name=data.name,
            phone=data.phone,
            email=data.email,
            payment_method=f"Mercado Pago ({payment_method_id})",
            is_card_payment=True,
            notes=data.notes,
            items=[
                PublicOrderItemCreate(
                    product_id=i.product_id,
                    quantity=i.quantity,
                    color=i.color,
                    is_card_payment=i.is_card_payment,
                )
                for i in data.items
            ],
        )
        sale = service.create_public_order(order_data)

        message = (
            "¡Pago aprobado!" if payment_status == "approved"
            else "Pago en proceso, te avisaremos cuando se confirme."
        )
        return MPProcessPaymentResponse(
            status=payment_status,
            sale_id=sale.id,
            message=message,
        )

    # Rejected
    status_detail = mp_data.get("status_detail", "")
    raise HTTPException(
        status_code=422,
        detail=f"Pago rechazado ({status_detail}). Por favor intentá con otra tarjeta o método de pago.",
    )


# ---------------------------------------------------------------------------
# POST /mp/webhook
# ---------------------------------------------------------------------------

@router.post("/mp/webhook")
async def mp_webhook(request: Request, db: Session = Depends(get_db)):
    """Receives MP payment notifications for status updates."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    topic = body.get("type") or request.query_params.get("topic", "")
    resource_id = body.get("data", {}).get("id") or request.query_params.get("id")

    logger.info("MP webhook: topic=%s id=%s", topic, resource_id)

    if topic == "payment" and resource_id:
        access_token, _ = _get_mp_credentials(db)
        if access_token:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{MP_API_BASE}/v1/payments/{resource_id}",
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    if resp.is_success:
                        payment_data = resp.json()
                        logger.info("MP webhook payment %s status: %s", resource_id, payment_data.get("status"))
            except Exception as exc:
                logger.warning("MP webhook fetch failed: %s", exc)

    return {"status": "ok"}
