"""Category management endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, verify_admin
from app.models.category import Category
from app.models.category_mapping import CategoryMapping
from app.models.product import Product
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryMappingCreate,
    CategoryMappingResponse,
    UnmappedCategoryResponse,
)

router = APIRouter()


def normalize_source_category(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def get_product_counts(db: Session, category_id: int) -> tuple[int, int]:
    """Get count of products in a category (total, enabled)."""
    total = db.query(Product).filter(Product.category_id == category_id).count()
    enabled = db.query(Product).filter(
        Product.category_id == category_id,
        Product.enabled == True,
    ).count()
    return total, enabled


@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """
    List all categories.

    Public endpoint - no auth required.
    """
    query = db.query(Category)

    if not include_inactive:
        query = query.filter(Category.is_active == True)

    categories = query.order_by(Category.display_order, Category.name).all()

    result = []
    for cat in categories:
        total, enabled = get_product_counts(db, cat.id)
        cat_dict = {
            "id": cat.id,
            "name": cat.name,
            "is_active": cat.is_active,
            "display_order": cat.display_order,
            "color": cat.color or "#6b7280",
            "show_in_menu": cat.show_in_menu or False,
            "created_at": cat.created_at,
            "updated_at": cat.updated_at,
            "product_count": total,
            "enabled_product_count": enabled,
        }
        result.append(CategoryResponse(**cat_dict))

    return result


@router.post("", response_model=CategoryResponse, dependencies=[Depends(verify_admin)])
async def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db)
):
    """Create a new category."""
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La categoría '{data.name}' ya existe",
        )

    category = Category(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)

    return CategoryResponse(
        id=category.id,
        name=category.name,
        is_active=category.is_active,
        display_order=category.display_order,
        color=category.color or "#6b7280",
        show_in_menu=category.show_in_menu or False,
        created_at=category.created_at,
        updated_at=category.updated_at,
        product_count=0,
        enabled_product_count=0,
    )


@router.patch("/{category_id}", response_model=CategoryResponse, dependencies=[Depends(verify_admin)])
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db)
):
    """Update a category."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

    if data.name and data.name != category.name:
        existing = db.query(Category).filter(Category.name == data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La categoría '{data.name}' ya existe",
            )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)

    total, enabled = get_product_counts(db, category.id)
    return CategoryResponse(
        id=category.id,
        name=category.name,
        is_active=category.is_active,
        display_order=category.display_order,
        color=category.color or "#6b7280",
        show_in_menu=category.show_in_menu or False,
        created_at=category.created_at,
        updated_at=category.updated_at,
        product_count=total,
        enabled_product_count=enabled,
    )


@router.delete("/{category_id}", dependencies=[Depends(verify_admin)])
async def delete_category(
    category_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a category.

    Products with this category will have category_id set to NULL.
    """
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

    db.query(Product).filter(Product.category_id == category.id).update(
        {Product.category_id: None},
        synchronize_session=False,
    )

    db.delete(category)
    db.commit()

    return {"message": f"Categoría '{category.name}' eliminada"}


@router.get("/unmapped-sources", response_model=List[UnmappedCategoryResponse], dependencies=[Depends(verify_admin)])
async def get_unmapped_source_categories(db: Session = Depends(get_db)):
    """Get source categories that still have no mapping."""
    mapped_keys = {m.source_key for m in db.query(CategoryMapping).all()}

    rows = (
        db.query(
            func.coalesce(Product.source_category, Product.category).label("source_name"),
            func.count(Product.id).label("product_count"),
        )
        .filter(func.coalesce(Product.source_category, Product.category).isnot(None))
        .group_by(func.coalesce(Product.source_category, Product.category))
        .all()
    )

    result: list[UnmappedCategoryResponse] = []
    for row in rows:
        source_name = (row.source_name or "").strip()
        if not source_name:
            continue
        source_key = normalize_source_category(source_name)
        if source_key in mapped_keys:
            continue
        result.append(
            UnmappedCategoryResponse(
                source_name=source_name,
                product_count=int(row.product_count or 0),
            )
        )

    result.sort(key=lambda x: (-x.product_count, x.source_name.lower()))
    return result


@router.get("/mappings", response_model=List[CategoryMappingResponse], dependencies=[Depends(verify_admin)])
async def list_category_mappings(db: Session = Depends(get_db)):
    mappings = (
        db.query(CategoryMapping)
        .join(Category, Category.id == CategoryMapping.category_id)
        .order_by(Category.name.asc(), CategoryMapping.source_name.asc())
        .all()
    )

    return [
        CategoryMappingResponse(
            id=m.id,
            source_name=m.source_name,
            source_key=m.source_key,
            category_id=m.category_id,
            category_name=m.category.name if m.category else "",
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in mappings
    ]


@router.post("/mappings", response_model=CategoryMappingResponse, dependencies=[Depends(verify_admin)])
async def create_or_update_category_mapping(data: CategoryMappingCreate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == data.category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")

    source_name = data.source_name.strip()
    source_key = normalize_source_category(source_name)
    if not source_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="source_name inválido")

    mapping = db.query(CategoryMapping).filter(CategoryMapping.source_key == source_key).first()
    if mapping:
        mapping.source_name = source_name
        mapping.category_id = data.category_id
    else:
        mapping = CategoryMapping(source_name=source_name, source_key=source_key, category_id=data.category_id)
        db.add(mapping)
        db.flush()

    if data.apply_existing:
        db.query(Product).filter(
            func.lower(func.trim(func.coalesce(Product.source_category, Product.category))) == source_key
        ).update(
            {Product.category_id: data.category_id},
            synchronize_session=False,
        )

    db.commit()
    db.refresh(mapping)

    return CategoryMappingResponse(
        id=mapping.id,
        source_name=mapping.source_name,
        source_key=mapping.source_key,
        category_id=mapping.category_id,
        category_name=category.name,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
    )


@router.delete("/mappings/{mapping_id}", dependencies=[Depends(verify_admin)])
async def delete_category_mapping(mapping_id: int, db: Session = Depends(get_db)):
    mapping = db.query(CategoryMapping).filter(CategoryMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapeo no encontrado")

    db.delete(mapping)
    db.commit()
    return {"message": "Mapeo eliminado"}
