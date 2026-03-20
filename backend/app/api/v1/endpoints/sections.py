"""Section management endpoints."""
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

logger = logging.getLogger(__name__)

from app.api.deps import get_db, verify_admin
from app.models.section import Section, SectionProduct
from app.models.product import Product
from app.schemas.section import SectionCreate, SectionUpdate, SectionResponse, SectionProductAdd, ProductInSection

router = APIRouter()


def resolve_section_products(section: Section, db: Session) -> List[ProductInSection]:
    """Resolve products for a section based on its criteria."""
    limit = section.max_products

    if section.criteria_type == "manual":
        items = (
            db.query(Product)
            .join(SectionProduct, SectionProduct.product_id == Product.id)
            .filter(SectionProduct.section_id == section.id, Product.enabled == True)
            .order_by(SectionProduct.display_order)
            .limit(limit)
            .all()
        )
    elif section.criteria_type == "featured":
        items = db.query(Product).filter(Product.enabled == True, Product.is_featured == True).limit(limit).all()
    elif section.criteria_type == "immediate_delivery":
        items = db.query(Product).filter(Product.enabled == True, Product.is_immediate_delivery == True).limit(limit).all()
    elif section.criteria_type == "best_seller":
        items = db.query(Product).filter(Product.enabled == True, Product.is_best_seller == True).limit(limit).all()
    elif section.criteria_type == "category" and section.criteria_value:
        items = db.query(Product).filter(Product.enabled == True, Product.category == section.criteria_value).limit(limit).all()
    else:
        items = []

    result = []
    for p in items:
        images = [{"id": img.id, "url": img.url, "alt_text": img.alt_text, "is_primary": img.is_primary} for img in (p.images or [])]
        result.append(ProductInSection(
            id=p.id, slug=p.slug,
            name=p.custom_name or p.original_name,
            price=p.final_price, currency=p.original_currency or "ARS",
            brand=p.brand, category=p.category, subcategory=p.subcategory,
            is_featured=p.is_featured or False, is_immediate_delivery=p.is_immediate_delivery or False,
            is_check_stock=p.is_check_stock or False, is_best_seller=p.is_best_seller or False,
            images=images,
        ))
    return result


@router.get("/public", response_model=List[SectionResponse])
async def list_public_sections(db: Session = Depends(get_db)):
    sections = db.query(Section).filter(Section.is_active == True).order_by(Section.display_order).all()
    result = []
    for s in sections:
        products = resolve_section_products(s, db)
        result.append(SectionResponse(
            id=s.id, title=s.title, subtitle=s.subtitle,
            display_order=s.display_order, is_active=s.is_active,
            criteria_type=s.criteria_type, criteria_value=s.criteria_value,
            max_products=s.max_products, bg_color=s.bg_color, text_color=s.text_color,
            image_url=s.image_url,
            created_at=s.created_at, updated_at=s.updated_at,
            products=products,
        ))
    return result


@router.get("", response_model=List[SectionResponse], dependencies=[Depends(verify_admin)])
async def list_sections(db: Session = Depends(get_db)):
    sections = db.query(Section).order_by(Section.display_order).all()
    result = []
    for s in sections:
        products = resolve_section_products(s, db)
        result.append(SectionResponse(
            id=s.id, title=s.title, subtitle=s.subtitle,
            display_order=s.display_order, is_active=s.is_active,
            criteria_type=s.criteria_type, criteria_value=s.criteria_value,
            max_products=s.max_products, bg_color=s.bg_color, text_color=s.text_color,
            image_url=s.image_url,
            created_at=s.created_at, updated_at=s.updated_at,
            products=products,
        ))
    return result


@router.post("", response_model=SectionResponse, dependencies=[Depends(verify_admin)])
async def create_section(data: SectionCreate, db: Session = Depends(get_db)):
    section = Section(**data.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    return SectionResponse(
        id=section.id, title=section.title, subtitle=section.subtitle,
        display_order=section.display_order, is_active=section.is_active,
        criteria_type=section.criteria_type, criteria_value=section.criteria_value,
        max_products=section.max_products, bg_color=section.bg_color, text_color=section.text_color,
        image_url=section.image_url,
        created_at=section.created_at, updated_at=section.updated_at,
        products=[],
    )


@router.put("/{section_id}", response_model=SectionResponse, dependencies=[Depends(verify_admin)])
async def update_section(section_id: int, data: SectionUpdate, db: Session = Depends(get_db)):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    updates = data.model_dump(exclude_none=True)
    logger.info(f"Updating section {section_id} with: {updates}")
    try:
        for field, value in updates.items():
            setattr(section, field, value)
        db.commit()
        db.refresh(section)
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating section {section_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    products = resolve_section_products(section, db)
    return SectionResponse(
        id=section.id, title=section.title, subtitle=section.subtitle,
        display_order=section.display_order, is_active=section.is_active,
        criteria_type=section.criteria_type, criteria_value=section.criteria_value,
        max_products=section.max_products, bg_color=section.bg_color, text_color=section.text_color,
        image_url=section.image_url,
        created_at=section.created_at, updated_at=section.updated_at,
        products=products,
    )


@router.delete("/{section_id}", dependencies=[Depends(verify_admin)])
async def delete_section(section_id: int, db: Session = Depends(get_db)):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    try:
        db.delete(section)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting section {section_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}


@router.post("/{section_id}/products", dependencies=[Depends(verify_admin)])
async def add_product_to_section(section_id: int, data: SectionProductAdd, db: Session = Depends(get_db)):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    existing = db.query(SectionProduct).filter(
        SectionProduct.section_id == section_id,
        SectionProduct.product_id == data.product_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Producto ya asignado")
    sp = SectionProduct(section_id=section_id, product_id=data.product_id, display_order=data.display_order)
    db.add(sp)
    db.commit()
    return {"ok": True}


@router.delete("/{section_id}/products/{product_id}", dependencies=[Depends(verify_admin)])
async def remove_product_from_section(section_id: int, product_id: int, db: Session = Depends(get_db)):
    sp = db.query(SectionProduct).filter(
        SectionProduct.section_id == section_id,
        SectionProduct.product_id == product_id
    ).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    db.delete(sp)
    db.commit()
    return {"ok": True}
