"""Category management endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, verify_admin
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
)

router = APIRouter()


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
            "show_in_carousel": cat.show_in_carousel or False,
            "carousel_title": cat.carousel_title,
            "carousel_subtitle": cat.carousel_subtitle,
            "carousel_image_url": cat.carousel_image_url,
            "carousel_bg_color": cat.carousel_bg_color,
            "carousel_text_color": cat.carousel_text_color,
            "carousel_font": cat.carousel_font,
            "carousel_filter_type": cat.carousel_filter_type,
            "carousel_glow": cat.carousel_glow or False,
            "carousel_glow_color": cat.carousel_glow_color,
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
            detail=f"La categoria '{data.name}' ya existe",
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
        show_in_carousel=category.show_in_carousel or False,
        carousel_title=category.carousel_title,
        carousel_subtitle=category.carousel_subtitle,
        carousel_image_url=category.carousel_image_url,
        carousel_bg_color=category.carousel_bg_color,
        carousel_text_color=category.carousel_text_color,
        carousel_font=category.carousel_font,
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
            detail="Categoria no encontrada",
        )

    if data.name and data.name != category.name:
        existing = db.query(Category).filter(Category.name == data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La categoria '{data.name}' ya existe",
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
        show_in_carousel=category.show_in_carousel or False,
        carousel_title=category.carousel_title,
        carousel_subtitle=category.carousel_subtitle,
        carousel_image_url=category.carousel_image_url,
        carousel_bg_color=category.carousel_bg_color,
        carousel_text_color=category.carousel_text_color,
        carousel_font=category.carousel_font,
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
            detail="Categoria no encontrada",
        )

    db.query(Product).filter(Product.category_id == category.id).update(
        {Product.category_id: None},
        synchronize_session=False,
    )

    db.delete(category)
    db.commit()

    return {"message": f"Categoria '{category.name}' eliminada"}
