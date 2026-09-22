"""Schemas for sales."""
from typing import List, Literal, Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class SaleItemCreate(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    color: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit_price: Decimal = Field(..., gt=0)
    delivered: Optional[bool] = None
    paid: Optional[bool] = None
    delivered_quantity: Optional[int] = Field(default=None, ge=0)


class SaleCreate(BaseModel):
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    installments: Optional[int] = Field(default=None, ge=0)
    installment_amounts: Optional[List[Decimal]] = None
    seller_id: int
    delivered: bool = False
    paid: bool = False
    payment_method: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    items: List[SaleItemCreate]
    # Override manual de la comisión: a lo sumo uno de los dos. Si no se manda
    # ninguno, se usa la tasa configurada en el admin (comisión automática).
    comision_porcentaje: Optional[Decimal] = Field(default=None, ge=0, le=100)
    comision_monto: Optional[Decimal] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_comision_exclusiva(self):
        if self.comision_porcentaje is not None and self.comision_monto is not None:
            raise ValueError("La comisión se carga por % o por monto, no ambos")
        return self


class SaleUpdate(BaseModel):
    delivered: Optional[bool] = None
    paid: Optional[bool] = None
    payment_method: Optional[str] = None
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    installments: Optional[int] = Field(default=None, ge=0)
    installment_amounts: Optional[List[Decimal]] = None
    seller_id: Optional[int] = None
    items: Optional[List[SaleItemCreate]] = None
    force: bool = False
    phone: Optional[str] = None
    email: Optional[str] = None
    delivery_method: Optional[Literal["pickup", "shipping", "agreement"]] = None
    shipping_zone: Optional[Literal["amba", "resto_pais"]] = None
    shipping_street: Optional[str] = None
    shipping_floor_apt: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_province: Optional[str] = None
    shipping_postal_code: Optional[str] = None
    shipping_reference: Optional[str] = None
    # Override manual de la comisión: a lo sumo uno de los dos.
    # comision_automatica=true vuelve a usar la tasa configurada en el admin.
    comision_porcentaje: Optional[Decimal] = Field(default=None, ge=0, le=100)
    comision_monto: Optional[Decimal] = Field(default=None, ge=0)
    comision_automatica: Optional[bool] = None

    @model_validator(mode="after")
    def _check_comision_exclusiva(self):
        if self.comision_porcentaje is not None and self.comision_monto is not None:
            raise ValueError("La comisión se carga por % o por monto, no ambos")
        return self


class SaleInstallmentUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0)
    paid: Optional[bool] = None


class SaleItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    color: Optional[str] = None
    quantity: int
    delivered_quantity: int
    delivered: bool
    paid: bool
    unit_price: Decimal
    total_price: Decimal
    es_oferta: bool = False

    class Config:
        from_attributes = True


class SaleInstallmentResponse(BaseModel):
    id: int
    number: int
    amount: Decimal
    paid: bool
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SaleResponse(BaseModel):
    id: int
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    installments: Optional[int] = None
    seller_id: int
    seller_nombre: str
    origen: str
    delivered: bool
    paid: bool
    payment_method: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    delivery_method: Optional[str] = None
    shipping_zone: Optional[str] = None
    shipping_street: Optional[str] = None
    shipping_floor_apt: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_province: Optional[str] = None
    shipping_postal_code: Optional[str] = None
    shipping_reference: Optional[str] = None
    total_amount: Decimal
    delivered_amount: Decimal
    paid_amount: Decimal
    items: List[SaleItemResponse]
    installment_list: List[SaleInstallmentResponse] = []
    created_at: Optional[datetime] = None
    # Override manual cargado en la venta (si lo hay) y la comisión ya
    # generada para esta venta (si está pagada); ver services/comisiones.py.
    comision_porcentaje_manual: Optional[Decimal] = None
    comision_monto_manual: Optional[Decimal] = None
    comision_tasa: Optional[Decimal] = None
    comision_monto: Optional[Decimal] = None
    comision_estado: Optional[str] = None

    class Config:
        from_attributes = True


class PublicOrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    color: Optional[str] = None
    is_card_payment: bool = False


class PublicOrderCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., min_length=6, max_length=50)
    email: str = Field(..., min_length=5, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    payment_method: Optional[str] = Field(None, max_length=100)
    is_card_payment: bool = False
    notes: Optional[str] = None
    delivery_method: Optional[Literal["pickup", "shipping", "agreement"]] = None
    shipping_street: Optional[str] = Field(None, max_length=255)
    shipping_floor_apt: Optional[str] = Field(None, max_length=100)
    shipping_city: Optional[str] = Field(None, max_length=150)
    shipping_province: Optional[str] = Field(None, max_length=100)
    shipping_postal_code: Optional[str] = Field(None, max_length=20)
    shipping_reference: Optional[str] = Field(None, max_length=255)
    items: List[PublicOrderItemCreate] = Field(..., min_length=1)


class PublicOrderResponse(BaseModel):
    id: int
    message: str = "Pedido recibido"
