"""Subcategory management endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, verify_admin
from app.models.subcategory import Subcategory
from app.models.category import Category
from app.models.product import Product
from app.schemas.subcategory import SubcategoryCreate, SubcategoryUpdate, SubcategoryResponse

router = APIRouter()


def get_product_counts(db: Session, category_id: int, subcategory_name: str) -> tuple[int, int]:
    """Get count of products in a subcategory (total, enabled)."""
    total = db.query(Product).filter(
        Product.category_id == category_id,
        Product.subcategory == subcategory_name
    ).count()
    enabled = db.query(Product).filter(
        Product.category_id == category_id,
        Product.subcategory == subcategory_name,
        Product.enabled == True
    ).count()
    return total, enabled


@router.get("", response_model=List[SubcategoryResponse])
async def list_subcategories(
    category_id: Optional[int] = Query(default=None),
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """
    List all subcategories.

    Public endpoint - no auth required.
    Can filter by category_id.
    """
    query = db.query(Subcategory)

    if category_id:
        query = query.filter(Subcategory.category_id == category_id)

    if not include_inactive:
        query = query.filter(Subcategory.is_active == True)

    subcategories = query.order_by(Subcategory.display_order, Subcategory.name).all()

    # Add product counts and category name
    result = []
    for sub in subcategories:
        category = db.query(Category).filter(Category.id == sub.category_id).first()
        category_name = category.name if category else None

        total, enabled = (0, 0)
        if category:
            total, enabled = get_product_counts(db, category.id, sub.name)

        sub_dict = {
            "id": sub.id,
            "name": sub.name,
            "category_id": sub.category_id,
            "category_name": category_name,
            "is_active": sub.is_active,
            "display_order": sub.display_order,
            "color": sub.color or "#6b7280",
            "created_at": sub.created_at,
            "updated_at": sub.updated_at,
            "product_count": total,
            "enabled_product_count": enabled
        }
        result.append(SubcategoryResponse(**sub_dict))

    return result


@router.post("", response_model=SubcategoryResponse, dependencies=[Depends(verify_admin)])
async def create_subcategory(
    data: SubcategoryCreate,
    db: Session = Depends(get_db)
):
    """Create a new subcategory."""
    # Check if category exists
    category = db.query(Category).filter(Category.id == data.category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )

    # Check if name already exists in this category
    existing = db.query(Subcategory).filter(
        Subcategory.name == data.name,
        Subcategory.category_id == data.category_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La subcategoría '{data.name}' ya existe en esta categoría"
        )

    subcategory = Subcategory(**data.model_dump())
    db.add(subcategory)
    db.commit()
    db.refresh(subcategory)

    return SubcategoryResponse(
        id=subcategory.id,
        name=subcategory.name,
        category_id=subcategory.category_id,
        category_name=category.name,
        is_active=subcategory.is_active,
        display_order=subcategory.display_order,
        color=subcategory.color or "#6b7280",
        created_at=subcategory.created_at,
        updated_at=subcategory.updated_at,
        product_count=0,
        enabled_product_count=0
    )


@router.patch("/{subcategory_id}", response_model=SubcategoryResponse, dependencies=[Depends(verify_admin)])
async def update_subcategory(
    subcategory_id: int,
    data: SubcategoryUpdate,
    db: Session = Depends(get_db)
):
    """Update a subcategory."""
    subcategory = db.query(Subcategory).filter(Subcategory.id == subcategory_id).first()
    if not subcategory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subcategoría no encontrada"
        )

    old_name = subcategory.name
    old_category_id = subcategory.category_id

    # Get target category
    target_category_id = data.category_id if data.category_id else subcategory.category_id
    target_category = db.query(Category).filter(Category.id == target_category_id).first()
    if not target_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada"
        )

    # Check if new name already exists in target category
    new_name = data.name if data.name else subcategory.name
    if data.name or data.category_id:
        existing = db.query(Subcategory).filter(
            Subcategory.name == new_name,
            Subcategory.category_id == target_category_id,
            Subcategory.id != subcategory_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La subcategoría '{new_name}' ya existe en esta categoría"
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subcategory, field, value)

    # If name changed, update all products with this subcategory (in the same category)
    if data.name and data.name != old_name:
        db.query(Product).filter(
            Product.category_id == old_category_id,
            Product.subcategory == old_name
        ).update(
            {Product.subcategory: data.name},
            synchronize_session=False
        )

    # If category changed, clear previous subcategory assignations on old category
    if data.category_id and data.category_id != old_category_id:
        # Clear subcategory from products that had this subcategory (since category changed)
        db.query(Product).filter(
            Product.category_id == old_category_id,
            Product.subcategory == old_name
        ).update(
            {Product.subcategory: None},
            synchronize_session=False
        )

    db.commit()
    db.refresh(subcategory)

    total, enabled = get_product_counts(db, target_category.id, subcategory.name)
    return SubcategoryResponse(
        id=subcategory.id,
        name=subcategory.name,
        category_id=subcategory.category_id,
        category_name=target_category.name,
        is_active=subcategory.is_active,
        display_order=subcategory.display_order,
        color=subcategory.color or "#6b7280",
        created_at=subcategory.created_at,
        updated_at=subcategory.updated_at,
        product_count=total,
        enabled_product_count=enabled
    )


@router.delete("/{subcategory_id}", dependencies=[Depends(verify_admin)])
async def delete_subcategory(
    subcategory_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a subcategory.

    Products with this subcategory will have their subcategory set to NULL.
    """
    subcategory = db.query(Subcategory).filter(Subcategory.id == subcategory_id).first()
    if not subcategory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subcategoría no encontrada"
        )

    # Get category name
    # Clear subcategory from products
    db.query(Product).filter(
        Product.category_id == subcategory.category_id,
        Product.subcategory == subcategory.name
    ).update(
        {Product.subcategory: None},
        synchronize_session=False
    )

    db.delete(subcategory)
    db.commit()

    return {"message": f"Subcategoría '{subcategory.name}' eliminada"}
