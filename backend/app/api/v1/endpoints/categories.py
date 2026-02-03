"""Category management endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, verify_admin
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter()


def get_product_counts(db: Session, category_name: str) -> tuple[int, int]:
    """Get count of products in a category (total, enabled)."""
    total = db.query(Product).filter(Product.category == category_name).count()
    enabled = db.query(Product).filter(
        Product.category == category_name,
        Product.enabled == True
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

    # Add product counts
    result = []
    for cat in categories:
        total, enabled = get_product_counts(db, cat.name)
        cat_dict = {
            "id": cat.id,
            "name": cat.name,
            "is_active": cat.is_active,
            "display_order": cat.display_order,
            "created_at": cat.created_at,
            "updated_at": cat.updated_at,
            "product_count": total,
            "enabled_product_count": enabled
        }
        result.append(CategoryResponse(**cat_dict))

    return result


@router.post("", response_model=CategoryResponse, dependencies=[Depends(verify_admin)])
async def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db)
):
    """Create a new category."""
    # Check if name already exists
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La categoría '{data.name}' ya existe"
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
        created_at=category.created_at,
        updated_at=category.updated_at,
        product_count=0,
        enabled_product_count=0
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
            detail="Categoría no encontrada"
        )

    old_name = category.name

    # Check if new name already exists
    if data.name and data.name != old_name:
        existing = db.query(Category).filter(Category.name == data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La categoría '{data.name}' ya existe"
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    # If name changed, update all products with this category
    if data.name and data.name != old_name:
        db.query(Product).filter(Product.category == old_name).update(
            {Product.category: data.name},
            synchronize_session=False
        )

    db.commit()
    db.refresh(category)

    total, enabled = get_product_counts(db, category.name)
    return CategoryResponse(
        id=category.id,
        name=category.name,
        is_active=category.is_active,
        display_order=category.display_order,
        created_at=category.created_at,
        updated_at=category.updated_at,
        product_count=total,
        enabled_product_count=enabled
    )


@router.delete("/{category_id}", dependencies=[Depends(verify_admin)])
async def delete_category(
    category_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a category.

    Products with this category will have their category set to NULL.
    """
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )

    # Clear category from products
    db.query(Product).filter(Product.category == category.name).update(
        {Product.category: None},
        synchronize_session=False
    )

    db.delete(category)
    db.commit()

    return {"message": f"Categoría '{category.name}' eliminada"}
