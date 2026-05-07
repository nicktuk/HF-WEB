"""Dispatcher de scraping: orquesta ML + USA scrapers para rubros activos."""
import logging
import importlib
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.retailer import ImportRetailer
from app.models.import_scorer.scrape_log import ImportScrapeLog

logger = logging.getLogger(__name__)
SCRAPERS_BASE = "app.scrapers.import_scorer"


async def ejecutar_scraping_completo(db: Session) -> dict:
    """
    Dispara scraping ML + USA para todos los rubros activos en orden de prioridad.
    Registra resultado en import_scrape_logs al finalizar.
    """
    rubros = (
        db.query(ImportRubro)
        .filter(ImportRubro.activo == True)
        .order_by(
            ImportRubro.prioridad.desc(),
            ImportRubro.nombre,
        )
        .all()
    )

    total_productos_act = 0
    total_errores = 0
    inicio = datetime.utcnow()

    for rubro in rubros:
        logger.info(f"Scraping rubro: {rubro.nombre}")

        # Scraping Mercado Libre
        try:
            ml_mod = importlib.import_module(f"{SCRAPERS_BASE}.mercadolibre")
            res = await ml_mod.scrape_rubro(rubro, db)
            total_productos_act += res.get("actualizados", 0)
            logger.info(f"  ML → {res.get('actualizados', 0)} actualizados")
        except ImportError:
            logger.warning("  Scraper ML no disponible")
            total_errores += 1
        except Exception as e:
            logger.error(f"  Error ML rubro {rubro.nombre}: {e}")
            total_errores += 1

        # Scraping USA por retailer configurado en el rubro
        for slug in (rubro.retailers_activos or []):
            retailer = (
                db.query(ImportRetailer)
                .filter(
                    ImportRetailer.slug == slug,
                    ImportRetailer.activo == True,
                )
                .first()
            )
            if not retailer:
                continue
            if retailer.pausado_hasta and retailer.pausado_hasta > datetime.utcnow():
                logger.debug(f"  Retailer {slug} pausado")
                continue

            try:
                usa_mod = importlib.import_module(f"{SCRAPERS_BASE}.{slug}")
                res = await usa_mod.scrape_rubro(rubro, retailer, db)
                total_productos_act += res.get("actualizados", 0)
                logger.info(f"  {slug} → {res.get('actualizados', 0)} actualizados")
            except ImportError:
                logger.debug(f"  Sin scraper para {slug}")
            except Exception as e:
                logger.error(f"  Error {slug} / {rubro.nombre}: {e}")
                retailer.ultimo_error = str(e)[:500]
                total_errores += 1

    duracion_ms = int((datetime.utcnow() - inicio).total_seconds() * 1000)

    log = ImportScrapeLog(
        fuente="completo",
        productos_act=total_productos_act,
        errores=total_errores,
        duracion_ms=duracion_ms,
    )
    db.add(log)
    db.commit()

    return {
        "status": "completado",
        "rubros_procesados": len(rubros),
        "productos_actualizados": total_productos_act,
        "errores": total_errores,
        "duracion_ms": duracion_ms,
    }


async def ejecutar_scraping_rubro(db: Session, rubro_id: str) -> dict:
    """Dispara scraping para un rubro específico."""
    rubro = db.query(ImportRubro).filter(ImportRubro.id == rubro_id).first()
    if not rubro:
        return {"error": "rubro_no_encontrado"}

    total = 0
    errores = 0

    try:
        ml_mod = importlib.import_module(f"{SCRAPERS_BASE}.mercadolibre")
        res = await ml_mod.scrape_rubro(rubro, db)
        total += res.get("actualizados", 0)
    except ImportError:
        pass
    except Exception as e:
        logger.error(f"Error ML: {e}")
        errores += 1

    for slug in (rubro.retailers_activos or []):
        try:
            retailer = (
                db.query(ImportRetailer)
                .filter(ImportRetailer.slug == slug, ImportRetailer.activo == True)
                .first()
            )
            if not retailer:
                continue
            usa_mod = importlib.import_module(f"{SCRAPERS_BASE}.{slug}")
            res = await usa_mod.scrape_rubro(rubro, retailer, db)
            total += res.get("actualizados", 0)
        except ImportError:
            pass
        except Exception as e:
            logger.error(f"Error {slug}: {e}")
            errores += 1

    log = ImportScrapeLog(
        fuente=f"rubro:{rubro.nombre}",
        productos_act=total,
        errores=errores,
    )
    db.add(log)
    db.commit()

    return {"rubro": rubro.nombre, "actualizados": total, "errores": errores}
