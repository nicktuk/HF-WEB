"""Vendedor — tabla única para vendedores de venta minorista (canal
catálogo/WhatsApp) y mayorista (canal comercios). Conserva el nombre físico
histórico `catalog_sellers` (Sale.seller_id y Order.seller_id ya apuntan
acá) pero es LA tabla de vendedores: `es_mayorista`, activado, habilita
todo lo que usa el canal comercios (login al portal /vendedores, cartera,
prospectos, comisiones) sobre la misma fila — no hay una segunda tabla ni
un link manual entre "vendedor" y "vendedor minorista", son la misma persona.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.orm import Session, relationship
from sqlalchemy.sql import func
from app.models.base import Base


class CatalogSeller(Base):
    __tablename__ = "catalog_sellers"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), nullable=False, unique=True)
    celular = Column(String(50), nullable=True)
    celular_normalizado = Column(String(20), unique=True, nullable=True)
    bot_habilitado = Column(Boolean, nullable=False, default=True)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # ── Canal mayorista (comercios) — solo relevante si es_mayorista=True ──
    es_mayorista = Column(Boolean, nullable=False, default=False)
    email = Column(Text, nullable=True)
    usuario = Column(Text, nullable=True, unique=True, index=True)
    password_hash = Column(Text, nullable=True)
    reset_token_hash = Column(Text, nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)
    debe_cambiar_password = Column(Boolean, nullable=False, default=False)

    comercios = relationship("Comercio", back_populates="vendedor")


def require_active_catalog_seller(db: Session, seller_id: int) -> "CatalogSeller":
    """Valida que el seller_id exista y esté activo. Usar en altas/ediciones desde el admin."""
    from app.core.exceptions import ValidationError

    seller = db.query(CatalogSeller).filter(
        CatalogSeller.id == seller_id, CatalogSeller.activo.is_(True)
    ).first()
    if not seller:
        raise ValidationError(f"Vendedor {seller_id} no encontrado o inactivo", field="seller_id")
    return seller
