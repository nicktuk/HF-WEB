"""
Endpoints para generación de descripciones cortas con IA.

POST /admin/ai/generate              → lanza batch job
GET  /admin/ai/job/{job_id}          → estado del job (para polling)
POST /admin/ai/job/{job_id}/cancel   → cancela el job
POST /admin/ai/generate/{product_id} → generación individual inmediata
GET  /admin/ai/stats                 → estadísticas de cobertura
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, Integer, cast
from sqlalchemy.orm import Session

from app.api.deps import get_product_service
from app.core.security import verify_admin
from app.db.session import get_db
from app.models.category import Category
from app.models.product import Product
from app.services.ai_description import JobState, _jobs, get_ai_service
from app.services.app_settings import get_ai_config
from app.config import settings

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    mode: str                          # "single" | "category" | "pending" | "all" | "selected"
    action: str = "description"        # "description" | "images" | "both"
    product_id: Optional[int] = None
    product_ids: Optional[List[int]] = None   # para mode="selected"
    category_id: Optional[int] = None
    force_regenerate: bool = False
    use_search: bool = True
    use_vision: bool = True
    use_source_refetch: bool = True
    use_image_search: bool = False


class JobResponse(BaseModel):
    job_id: str
    total: int


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    total: int
    processed: int
    success: int
    failed: int
    progress_pct: float
    errors: List[dict]
    results: List[dict]


class SingleResponse(BaseModel):
    product_id: int
    short_description: str


# ---------------------------------------------------------------------------
# POST /generate  →  lanza batch
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=JobResponse, dependencies=[Depends(verify_admin)])
async def generate_descriptions(
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    query = db.query(Product.id).filter(Product.enabled == True)

    if req.mode == "single":
        if not req.product_id:
            raise HTTPException(status_code=400, detail="product_id requerido para mode=single")
        query = query.filter(Product.id == req.product_id)

    elif req.mode == "category":
        if not req.category_id:
            raise HTTPException(status_code=400, detail="category_id requerido para mode=category")
        query = query.filter(Product.category_id == req.category_id)

    elif req.mode == "pending":
        query = query.filter(Product.short_description == None)

    elif req.mode == "all":
        pass  # sin filtro adicional

    elif req.mode == "selected":
        if not req.product_ids:
            raise HTTPException(status_code=400, detail="product_ids requerido para mode=selected")
        query = query.filter(Product.id.in_(req.product_ids))

    else:
        raise HTTPException(status_code=400, detail=f"mode inválido: {req.mode}")

    # Si no se fuerza re-generación, solo procesar los que no tienen descripción
    # (excepto "single" que siempre regenera, y "pending" que ya lo filtra)
    if not req.force_regenerate and req.mode not in ("single", "pending", "selected"):
        query = query.filter(Product.short_description == None)

    product_ids = [row[0] for row in query.all()]

    if not product_ids:
        raise HTTPException(status_code=404, detail="No hay productos para procesar con esos criterios")

    job_id = uuid.uuid4().hex[:10]
    _jobs[job_id] = JobState(job_id=job_id, total=len(product_ids))

    ai_config = get_ai_config(db)
    ai = get_ai_service()
    background_tasks.add_task(
        ai.run_batch_job,
        job_id=job_id,
        product_ids=product_ids,
        use_search=req.use_search,
        use_vision=req.use_vision,
        use_source_refetch=req.use_source_refetch,
        use_image_search=req.use_image_search,
        action=req.action,
        config=ai_config,
    )

    return JobResponse(job_id=job_id, total=len(product_ids))


# ---------------------------------------------------------------------------
# GET /job/{job_id}  →  polling de estado
# ---------------------------------------------------------------------------

@router.get("/job/{job_id}", response_model=JobStatusResponse, dependencies=[Depends(verify_admin)])
async def get_job_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    pct = round(job.processed / job.total * 100, 1) if job.total else 0
    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        total=job.total,
        processed=job.processed,
        success=job.success,
        failed=job.failed,
        progress_pct=pct,
        errors=job.errors[-20:],
        results=list(reversed(job.results[-30:])),
    )


# ---------------------------------------------------------------------------
# POST /job/{job_id}/cancel
# ---------------------------------------------------------------------------

@router.post("/job/{job_id}/cancel", dependencies=[Depends(verify_admin)])
async def cancel_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    if job.status == "running":
        job.status = "cancelled"
    return {"ok": True, "status": job.status}


# ---------------------------------------------------------------------------
# POST /search-images/{product_id}  →  solo búsqueda de imágenes
# ---------------------------------------------------------------------------

@router.post(
    "/search-images/{product_id}",
    dependencies=[Depends(verify_admin)],
)
async def search_images_single(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    ai_config = get_ai_config(db)
    ai = get_ai_service()
    try:
        urls = await ai.search_images_for_product(product, config=ai_config, db=db)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    db.commit()
    return {"product_id": product_id, "found": len(urls), "urls": urls}


# ---------------------------------------------------------------------------
# POST /generate/{product_id}  →  generación individual inmediata
# ---------------------------------------------------------------------------

@router.post(
    "/generate/{product_id}",
    response_model=SingleResponse,
    dependencies=[Depends(verify_admin)],
)
async def generate_single(
    product_id: int,
    use_search: bool = Query(default=True),
    use_vision: bool = Query(default=True),
    use_source_refetch: bool = Query(default=True),
    use_image_search: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    ai_config = get_ai_config(db)
    ai = get_ai_service()
    try:
        desc = await ai.generate_for_product(
            product, use_search, use_vision, use_source_refetch,
            use_image_search=use_image_search, config=ai_config, db=db,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    product.short_description = desc[:2000]
    db.commit()

    return SingleResponse(product_id=product_id, short_description=desc)


# ---------------------------------------------------------------------------
# GET /stats  →  cobertura de descripciones
# ---------------------------------------------------------------------------

@router.get("/stats", dependencies=[Depends(verify_admin)])
async def get_stats(db: Session = Depends(get_db)):
    total_enabled = db.query(Product).filter(Product.enabled == True).count()
    with_desc = (
        db.query(Product)
        .filter(Product.enabled == True, Product.short_description != None)
        .count()
    )

    # Por categoría
    rows = (
        db.query(
            Category.id,
            Category.name,
            func.count(Product.id).label("total"),
            func.sum(
                cast(Product.short_description != None, Integer)
            ).label("with_desc"),
        )
        .join(Product, Product.category_id == Category.id)
        .filter(Product.enabled == True)
        .group_by(Category.id, Category.name)
        .order_by(Category.name)
        .all()
    )

    return {
        "total_enabled": total_enabled,
        "with_description": with_desc,
        "without_description": total_enabled - with_desc,
        "ai_provider": settings.AI_PROVIDER,
        "web_search_enabled": settings.AI_WEB_SEARCH_ENABLED and bool(settings.BRAVE_SEARCH_API_KEY),
        "vision_enabled": settings.AI_VISION_ENABLED,
        "categories": [
            {
                "id": r.id,
                "name": r.name,
                "total": r.total,
                "with_desc": int(r.with_desc or 0),
                "pending": r.total - int(r.with_desc or 0),
            }
            for r in rows
        ],
    }
