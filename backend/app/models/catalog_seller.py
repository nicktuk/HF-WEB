"""Catalog seller model - vendedores del canal catálogo (ventas propias)."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import Session
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


def require_active_catalog_seller(db: Session, seller_id: int) -> "CatalogSeller":
    """Valida que el seller_id exista y esté activo. Usar en altas/ediciones desde el admin."""
    from app.core.exceptions import ValidationError

    seller = db.query(CatalogSeller).filter(
        CatalogSeller.id == seller_id, CatalogSeller.activo.is_(True)
    ).first()
    if not seller:
        raise ValidationError(f"Vendedor {seller_id} no encontrado o inactivo", field="seller_id")
    return seller
