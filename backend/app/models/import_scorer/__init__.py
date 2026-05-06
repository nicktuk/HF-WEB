"""Import Scorer models."""
from app.models.import_scorer.rubro_template import ImportRubroTemplate
from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.retailer import ImportRetailer
from app.models.import_scorer.outlet import ImportOutlet
from app.models.import_scorer.producto import ImportProducto, ImportOfertaRetailer, ImportHistorico
from app.models.import_scorer.carrito import ImportCarrito, ImportCarritoItem
from app.models.import_scorer.lista_caza import ImportListaCaza
from app.models.import_scorer.config import ImportConfig
from app.models.import_scorer.scrape_log import ImportScrapeLog

__all__ = [
    "ImportRubroTemplate",
    "ImportRubro",
    "ImportRetailer",
    "ImportOutlet",
    "ImportProducto",
    "ImportOfertaRetailer",
    "ImportHistorico",
    "ImportCarrito",
    "ImportCarritoItem",
    "ImportListaCaza",
    "ImportConfig",
    "ImportScrapeLog",
]
