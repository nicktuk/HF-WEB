"""Clasificación de zona de envío (AMBA / resto del país) a partir del código postal."""
import re
from typing import Optional
from sqlalchemy.orm import Session

from app.models.codigo_amba import CodigoAmba


def extract_postal_digits(postal_code: Optional[str]) -> Optional[int]:
    """Extrae los primeros 4 dígitos consecutivos de un código postal en cualquier formato."""
    if not postal_code:
        return None
    match = re.search(r"\d{4}", postal_code)
    return int(match.group()) if match else None


def classify_shipping_zone(db: Session, postal_code: Optional[str]) -> str:
    """Devuelve 'amba' si el CP cae dentro de algún rango cargado, si no 'resto_pais'."""
    cp = extract_postal_digits(postal_code)
    if cp is None:
        return "resto_pais"

    match = (
        db.query(CodigoAmba)
        .filter(CodigoAmba.codigo_desde <= cp, CodigoAmba.codigo_hasta >= cp)
        .first()
    )
    return "amba" if match else "resto_pais"
