"""CRUD de listas de caza + export PDF."""
import io
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.lista_caza import ImportListaCaza
from app.models.import_scorer.outlet import ImportOutlet
from app.schemas.import_scorer.lista_caza import (
    ImportListaCazaCreate,
    ImportListaCazaUpdate,
    ImportListaCazaResponse,
)

router = APIRouter()


@router.get("", response_model=List[ImportListaCazaResponse])
def list_listas(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    return db.query(ImportListaCaza).order_by(ImportListaCaza.fecha.desc()).all()


@router.post("", response_model=ImportListaCazaResponse, status_code=201)
def create_lista(
    data: ImportListaCazaCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    lista = ImportListaCaza(**data.model_dump())
    db.add(lista)
    db.commit()
    db.refresh(lista)
    return lista


@router.get("/{lista_id}", response_model=ImportListaCazaResponse)
def get_lista(
    lista_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    lista = db.query(ImportListaCaza).filter(ImportListaCaza.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista de caza no encontrada")
    return lista


@router.put("/{lista_id}", response_model=ImportListaCazaResponse)
def update_lista(
    lista_id: str,
    data: ImportListaCazaUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    lista = db.query(ImportListaCaza).filter(ImportListaCaza.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista de caza no encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lista, field, value)
    db.commit()
    db.refresh(lista)
    return lista


@router.get("/{lista_id}/pdf")
def export_pdf(
    lista_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Genera y descarga un PDF con la lista de caza."""
    lista = db.query(ImportListaCaza).filter(ImportListaCaza.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista de caza no encontrada")

    outlets = {
        o.id: o for o in db.query(ImportOutlet).filter(
            ImportOutlet.id.in_(lista.outlets_recomendados_ids or [])
        ).all()
    }

    buffer = _generar_pdf(lista, outlets)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="lista_caza_{lista_id[:8]}.pdf"'},
    )


def _generar_pdf(lista: ImportListaCaza, outlets: dict) -> io.BytesIO:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    # Título
    story.append(Paragraph(f"Lista de Caza #{lista.id[:8]}", styles["Title"]))
    story.append(Paragraph(
        f"Fecha: {lista.fecha.strftime('%d/%m/%Y')} — Estado: {lista.estado} — "
        f"Total estimado: USD {lista.total_estimado_usd:,.2f}",
        styles["Normal"],
    ))
    story.append(Spacer(1, 0.5*cm))

    # Outlets recomendados
    if outlets:
        outlet_text = ", ".join(
            f"{o.nombre} ({o.ciudad}, {o.estado})" for o in outlets.values()
        )
        story.append(Paragraph(f"<b>Outlets recomendados:</b> {outlet_text}", styles["Normal"]))
        story.append(Spacer(1, 0.3*cm))

    # Tabla de productos
    headers = ["#", "Producto", "Cant.", "Precio obj. USD", "Total USD", "Peso kg"]
    rows = [headers]
    for idx, p in enumerate(lista.productos or [], 1):
        rows.append([
            str(idx),
            p.get("nombre", "")[:50],
            str(p.get("cantidad", 1)),
            f"${p.get('precio_objetivo_usd', 0):,.2f}",
            f"${p.get('costo_estimado_total_usd', 0):,.2f}",
            f"{p.get('peso_kg', 0):.2f}",
        ])

    col_widths = [1*cm, 7*cm, 1.5*cm, 3*cm, 3*cm, 2*cm]
    table = Table(rows, colWidths=col_widths)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (2, 0), (-1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)

    if lista.notas_agencia:
        story.append(Spacer(1, 0.5*cm))
        story.append(Paragraph(f"<b>Notas:</b> {lista.notas_agencia}", styles["Normal"]))

    doc.build(story)
    buffer.seek(0)
    return buffer
