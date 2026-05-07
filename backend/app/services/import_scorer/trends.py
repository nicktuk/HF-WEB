"""Servicio de tendencias usando Google Trends (pytrends)."""
import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.trend_snapshot import ImportTrendSnapshot

logger = logging.getLogger(__name__)


def _calcular_tendencia(valores: list[int]) -> str:
    """Clasifica la tendencia comparando la segunda mitad vs la primera."""
    if not valores or len(valores) < 4:
        return "sin_datos"
    mitad = len(valores) // 2
    primera = sum(valores[:mitad]) / mitad
    segunda = sum(valores[mitad:]) / (len(valores) - mitad)
    if primera == 0:
        return "subiendo" if segunda > 0 else "sin_datos"
    cambio = (segunda - primera) / primera
    if cambio > 0.2:
        return "subiendo"
    if cambio < -0.2:
        return "bajando"
    return "estable"


def _score_tendencia(valores: list[int]) -> float:
    """Score 0-100 basado en el promedio de las últimas 4 semanas."""
    if not valores:
        return 0.0
    recientes = valores[-4:] if len(valores) >= 4 else valores
    return round(sum(recientes) / len(recientes), 1)


async def actualizar_trends_rubro(db: Session, rubro: ImportRubro) -> dict:
    """Obtiene trends de Google para los keywords del rubro y guarda snapshot."""
    keywords = rubro.palabras_busqueda_usa or []
    if not keywords:
        return {"error": "sin_keywords"}

    keyword = keywords[0]

    try:
        from pytrends.request import TrendReq
        pt = TrendReq(hl="es-AR", tz=-180, timeout=(10, 25))
        pt.build_payload([keyword], timeframe="today 3-m", geo="")

        df = pt.interest_over_time()
        if df.empty:
            return {"error": "sin_datos_trends"}

        data_global = [int(v) for v in df[keyword].tolist()]

        pt.build_payload([keyword], timeframe="today 3-m", geo="AR")
        df_ar = pt.interest_over_time()
        data_ar = [int(v) for v in df_ar[keyword].tolist()] if not df_ar.empty else []

        pt.build_payload([keyword], timeframe="today 3-m", geo="US")
        df_us = pt.interest_over_time()
        data_usa = [int(v) for v in df_us[keyword].tolist()] if not df_us.empty else []

        snapshot = (
            db.query(ImportTrendSnapshot)
            .filter(ImportTrendSnapshot.rubro_id == rubro.id)
            .first()
        )
        if not snapshot:
            snapshot = ImportTrendSnapshot(rubro_id=rubro.id, keyword=keyword)
            db.add(snapshot)

        snapshot.keyword = keyword
        snapshot.data_ar = data_ar
        snapshot.data_usa = data_usa
        snapshot.score_ar = _score_tendencia(data_ar)
        snapshot.score_usa = _score_tendencia(data_usa)
        snapshot.tendencia_ar = _calcular_tendencia(data_ar)
        snapshot.tendencia_usa = _calcular_tendencia(data_usa)
        snapshot.updated_at = datetime.utcnow()

        db.commit()
        return {
            "keyword": keyword,
            "score_ar": snapshot.score_ar,
            "score_usa": snapshot.score_usa,
            "tendencia_ar": snapshot.tendencia_ar,
            "tendencia_usa": snapshot.tendencia_usa,
        }

    except ImportError:
        logger.error("pytrends no instalado")
        return {"error": "pytrends_no_disponible"}
    except Exception as e:
        logger.error(f"Trends error para '{keyword}': {e}")
        return {"error": str(e)}


async def actualizar_trends_todos(db: Session) -> dict:
    """Actualiza trends para todos los rubros activos con keywords."""
    rubros = (
        db.query(ImportRubro)
        .filter(ImportRubro.activo == True)
        .all()
    )
    resultados = []
    for rubro in rubros:
        if not rubro.palabras_busqueda_usa:
            continue
        res = await actualizar_trends_rubro(db, rubro)
        resultados.append({"rubro": rubro.nombre, **res})

    return {"procesados": len(resultados), "resultados": resultados}
