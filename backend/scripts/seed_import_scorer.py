"""
Seed para Import Scorer: 10 templates, 17 retailers, 11 outlets, rubros iniciales, config.

Run with: python -m scripts.seed_import_scorer
"""
import sys
import os
import uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.import_scorer.rubro_template import ImportRubroTemplate
from app.models.import_scorer.retailer import ImportRetailer
from app.models.import_scorer.outlet import ImportOutlet
from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.config import ImportConfig


RETAILERS_DATA = [
    {"nombre": "Walmart", "slug": "walmart", "tipo": "online", "base_url": "https://www.walmart.com", "search_url_template": "https://www.walmart.com/search?q={query}", "scraper_implementacion": "walmart", "cobra_tax_fl": True, "envio_gratis_umbral": 35.0, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "Target", "slug": "target", "tipo": "online", "base_url": "https://www.target.com", "search_url_template": "https://www.target.com/s?searchTerm={query}", "scraper_implementacion": "target", "cobra_tax_fl": True, "envio_gratis_umbral": 35.0, "delay_min_ms": 2500, "delay_max_ms": 5000},
    {"nombre": "Best Buy", "slug": "bestbuy", "tipo": "online", "base_url": "https://www.bestbuy.com", "search_url_template": "https://www.bestbuy.com/site/searchpage.jsp?st={query}", "scraper_implementacion": "bestbuy", "cobra_tax_fl": True, "envio_gratis_umbral": None, "delay_min_ms": 3000, "delay_max_ms": 6000},
    {"nombre": "Costco", "slug": "costco", "tipo": "online", "base_url": "https://www.costco.com", "search_url_template": "https://www.costco.com/CatalogSearch?keyword={query}", "scraper_implementacion": "costco", "cobra_tax_fl": True, "envio_gratis_umbral": None, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "Sam's Club", "slug": "samsclub", "tipo": "online", "base_url": "https://www.samsclub.com", "search_url_template": "https://www.samsclub.com/s/{query}", "scraper_implementacion": "samsclub", "cobra_tax_fl": True, "envio_gratis_umbral": None, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "Macy's", "slug": "macys", "tipo": "online", "base_url": "https://www.macys.com", "search_url_template": "https://www.macys.com/shop/featured/{query}", "scraper_implementacion": "macys", "cobra_tax_fl": True, "envio_gratis_umbral": 25.0, "delay_min_ms": 2000, "delay_max_ms": 5000},
    {"nombre": "Kohl's", "slug": "kohls", "tipo": "online", "base_url": "https://www.kohls.com", "search_url_template": "https://www.kohls.com/search/results.jsp?N=0&Ntt={query}", "scraper_implementacion": "kohls", "cobra_tax_fl": True, "envio_gratis_umbral": 49.0, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "Wayfair", "slug": "wayfair", "tipo": "online", "base_url": "https://www.wayfair.com", "search_url_template": "https://www.wayfair.com/keyword.php?keyword={query}", "scraper_implementacion": "wayfair", "cobra_tax_fl": True, "envio_gratis_umbral": None, "delay_min_ms": 2500, "delay_max_ms": 5000},
    {"nombre": "Home Depot", "slug": "homedepot", "tipo": "online", "base_url": "https://www.homedepot.com", "search_url_template": "https://www.homedepot.com/s/{query}", "scraper_implementacion": "homedepot", "cobra_tax_fl": True, "envio_gratis_umbral": 45.0, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "Lowe's", "slug": "lowes", "tipo": "online", "base_url": "https://www.lowes.com", "search_url_template": "https://www.lowes.com/search?searchTerm={query}", "scraper_implementacion": "lowes", "cobra_tax_fl": True, "envio_gratis_umbral": 45.0, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "Nordstrom Rack", "slug": "nordstromrack", "tipo": "online", "base_url": "https://www.nordstromrack.com", "search_url_template": "https://www.nordstromrack.com/search?query={query}", "scraper_implementacion": "nordstromrack", "cobra_tax_fl": True, "envio_gratis_umbral": None, "delay_min_ms": 2500, "delay_max_ms": 5000},
    {"nombre": "Saks Off 5th", "slug": "saksoff5th", "tipo": "online", "base_url": "https://www.saksoff5th.com", "search_url_template": "https://www.saksoff5th.com/search/{query}", "scraper_implementacion": "saksoff5th", "cobra_tax_fl": True, "envio_gratis_umbral": None, "delay_min_ms": 2500, "delay_max_ms": 5000},
    {"nombre": "Sierra", "slug": "sierra", "tipo": "online", "base_url": "https://www.sierra.com", "search_url_template": "https://www.sierra.com/search#W={query}", "scraper_implementacion": "sierra", "cobra_tax_fl": True, "envio_gratis_umbral": None, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "Dick's Sporting Goods", "slug": "dickssporting", "tipo": "online", "base_url": "https://www.dickssportinggoods.com", "search_url_template": "https://www.dickssportinggoods.com/search/SearchDisplay?searchTerm={query}", "scraper_implementacion": "dickssporting", "cobra_tax_fl": True, "envio_gratis_umbral": 49.0, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "B&H Photo", "slug": "bhphoto", "tipo": "online", "base_url": "https://www.bhphotovideo.com", "search_url_template": "https://www.bhphotovideo.com/c/search?Ntt={query}", "scraper_implementacion": "bhphoto", "cobra_tax_fl": False, "envio_gratis_umbral": None, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "Tuesday Morning", "slug": "tuesdaymorning", "tipo": "online", "base_url": "https://www.tuesdaymorning.com", "search_url_template": "https://www.tuesdaymorning.com/search?q={query}", "scraper_implementacion": "tuesdaymorning", "cobra_tax_fl": True, "envio_gratis_umbral": None, "delay_min_ms": 2000, "delay_max_ms": 4000},
    {"nombre": "REI", "slug": "rei", "tipo": "online", "base_url": "https://www.rei.com", "search_url_template": "https://www.rei.com/search?q={query}", "scraper_implementacion": "rei", "cobra_tax_fl": True, "envio_gratis_umbral": 50.0, "delay_min_ms": 2000, "delay_max_ms": 4000},
]

OUTLETS_DATA = [
    {"nombre": "TJ Maxx", "tipo": "tienda", "ciudad": "Varios", "estado": "Florida", "rubros_tipicos": ["Bazar y hogar premium", "Belleza y cuidado personal", "Ropa de marca", "Calzado de marca", "Juguetería y kids"]},
    {"nombre": "Marshalls", "tipo": "tienda", "ciudad": "Varios", "estado": "Florida", "rubros_tipicos": ["Bazar y hogar premium", "Belleza y cuidado personal", "Ropa de marca", "Calzado de marca"]},
    {"nombre": "HomeGoods", "tipo": "tienda", "ciudad": "Varios", "estado": "Florida", "rubros_tipicos": ["Bazar y hogar premium", "Cocina chica y gadgets", "Juguetería y kids"]},
    {"nombre": "Sierra (físico)", "tipo": "tienda", "ciudad": "Varios", "estado": "Florida", "rubros_tipicos": ["Deportes y outdoor"]},
    {"nombre": "Ross Dress for Less", "tipo": "tienda", "ciudad": "Varios", "estado": "Florida", "rubros_tipicos": ["Ropa de marca", "Calzado de marca", "Bazar y hogar premium"]},
    {"nombre": "Burlington", "tipo": "tienda", "ciudad": "Varios", "estado": "Florida", "rubros_tipicos": ["Ropa de marca", "Calzado de marca", "Juguetería y kids"]},
    {"nombre": "Big Lots", "tipo": "tienda", "ciudad": "Varios", "estado": "Florida", "rubros_tipicos": ["Bazar y hogar premium", "Cocina chica y gadgets", "Juguetería y kids"]},
    {"nombre": "At Home", "tipo": "tienda", "ciudad": "Varios", "estado": "Florida", "rubros_tipicos": ["Bazar y hogar premium"]},
    {"nombre": "Five Below", "tipo": "tienda", "ciudad": "Varios", "estado": "Florida", "rubros_tipicos": ["Juguetería y kids", "Cocina chica y gadgets"]},
    {"nombre": "Sawgrass Mills", "tipo": "mall_outlet", "ciudad": "Sunrise", "estado": "Florida", "direccion": "12801 W Sunrise Blvd, Sunrise, FL 33323", "rubros_tipicos": ["Ropa de marca", "Calzado de marca", "Bazar y hogar premium", "Belleza y cuidado personal"]},
    {"nombre": "Dolphin Mall", "tipo": "mall_outlet", "ciudad": "Miami", "estado": "Florida", "direccion": "11401 NW 12th St, Miami, FL 33172", "rubros_tipicos": ["Ropa de marca", "Calzado de marca", "Electrónica de consumo"]},
]

TEMPLATES_DATA = [
    {
        "nombre": "Electrónica de consumo",
        "descripcion": "Gadgets, electrodomésticos pequeños, audio, TV, etc.",
        "retailers_slugs": ["walmart", "target", "bestbuy", "costco", "samsclub", "bhphoto"],
        "outlets_nombres": [],
        "margen_minimo_verde": 2.0,
        "margen_minimo_amarillo": 1.6,
        "top_n_scraping_default": 50,
        "dias_rotacion_esperada": 30,
        "palabras_clave_default": ["electronics", "gadget", "tech", "smart"],
        "blacklist_default": ["refurbished", "used", "broken", "for parts", "damaged"],
    },
    {
        "nombre": "Bazar y hogar premium",
        "descripcion": "Artículos para el hogar, decoración, tumblers, kitchenware.",
        "retailers_slugs": ["wayfair", "macys", "walmart", "target", "sierra"],
        "outlets_nombres": ["TJ Maxx", "HomeGoods", "Marshalls", "Sawgrass Mills", "Dolphin Mall"],
        "margen_minimo_verde": 2.5,
        "margen_minimo_amarillo": 1.8,
        "top_n_scraping_default": 50,
        "dias_rotacion_esperada": 60,
        "palabras_clave_default": ["tumbler", "insulated", "kitchenware", "home decor", "stanley"],
        "blacklist_default": ["damaged", "broken", "used"],
    },
    {
        "nombre": "Cocina chica y gadgets",
        "descripcion": "Electrodomésticos pequeños de cocina, utensilios, gadgets.",
        "retailers_slugs": ["walmart", "target", "bestbuy", "homedepot", "wayfair"],
        "outlets_nombres": ["HomeGoods", "TJ Maxx", "Big Lots"],
        "margen_minimo_verde": 2.5,
        "margen_minimo_amarillo": 1.8,
        "top_n_scraping_default": 50,
        "dias_rotacion_esperada": 45,
        "palabras_clave_default": ["kitchen", "cooking", "blender", "coffee maker", "air fryer"],
        "blacklist_default": ["used", "refurbished", "broken"],
    },
    {
        "nombre": "Belleza y cuidado personal",
        "descripcion": "Cosméticos, skincare, haircare, perfumes.",
        "retailers_slugs": ["walmart", "target", "macys", "kohls", "nordstromrack"],
        "outlets_nombres": ["Marshalls", "TJ Maxx", "Ross Dress for Less"],
        "margen_minimo_verde": 2.8,
        "margen_minimo_amarillo": 2.0,
        "top_n_scraping_default": 50,
        "dias_rotacion_esperada": 60,
        "palabras_clave_default": ["skincare", "beauty", "makeup", "perfume", "hair"],
        "blacklist_default": ["used", "expired", "damaged"],
    },
    {
        "nombre": "Ropa de marca",
        "descripcion": "Indumentaria de marcas reconocibles con demanda en Argentina.",
        "retailers_slugs": ["macys", "kohls", "nordstromrack", "saksoff5th"],
        "outlets_nombres": ["TJ Maxx", "Marshalls", "Ross Dress for Less", "Burlington", "Sawgrass Mills"],
        "margen_minimo_verde": 3.0,
        "margen_minimo_amarillo": 2.2,
        "top_n_scraping_default": 50,
        "dias_rotacion_esperada": 90,
        "palabras_clave_default": ["brand", "authentic", "original"],
        "blacklist_default": ["used", "damaged", "no brand", "generic"],
    },
    {
        "nombre": "Smart Home y tech accessories",
        "descripcion": "Dispositivos smart home, accesorios tech, cables, cargadores.",
        "retailers_slugs": ["bestbuy", "walmart", "target", "homedepot"],
        "outlets_nombres": [],
        "margen_minimo_verde": 2.2,
        "margen_minimo_amarillo": 1.7,
        "top_n_scraping_default": 50,
        "dias_rotacion_esperada": 35,
        "palabras_clave_default": ["smart home", "alexa", "google home", "charger", "accessories"],
        "blacklist_default": ["used", "refurbished", "broken"],
    },
    {
        "nombre": "Celulares y tablets",
        "descripcion": "Smartphones y tablets. FLAG: ENACOM — solo referencia.",
        "retailers_slugs": ["bestbuy", "walmart", "costco", "samsclub"],
        "outlets_nombres": [],
        "margen_minimo_verde": 2.0,
        "margen_minimo_amarillo": 1.5,
        "top_n_scraping_default": 30,
        "dias_rotacion_esperada": None,
        "flag_restriccion": "ENACOM",
        "palabras_clave_default": ["smartphone", "tablet", "iphone", "android"],
        "blacklist_default": ["used", "refurbished", "cracked", "locked"],
    },
    {
        "nombre": "Calzado de marca",
        "descripcion": "Zapatillas y calzado de marcas con demanda.",
        "retailers_slugs": ["macys", "nordstromrack", "kohls"],
        "outlets_nombres": ["TJ Maxx", "Marshalls", "Ross Dress for Less", "Burlington", "Sawgrass Mills"],
        "margen_minimo_verde": 2.8,
        "margen_minimo_amarillo": 2.0,
        "top_n_scraping_default": 50,
        "dias_rotacion_esperada": 75,
        "palabras_clave_default": ["sneakers", "shoes", "boots", "nike", "adidas"],
        "blacklist_default": ["used", "damaged", "worn"],
    },
    {
        "nombre": "Juguetería y kids",
        "descripcion": "Juguetes, juegos de mesa, artículos para niños.",
        "retailers_slugs": ["walmart", "target", "costco", "samsclub"],
        "outlets_nombres": ["TJ Maxx", "HomeGoods", "Big Lots"],
        "margen_minimo_verde": 2.5,
        "margen_minimo_amarillo": 1.8,
        "top_n_scraping_default": 50,
        "dias_rotacion_esperada": 90,
        "es_estacional": True,
        "meses_alta_demanda": [10, 11, 12],
        "palabras_clave_default": ["toy", "kids", "children", "game", "lego"],
        "blacklist_default": ["used", "damaged", "parts only"],
    },
    {
        "nombre": "Deportes y outdoor",
        "descripcion": "Artículos deportivos, camping, outdoor.",
        "retailers_slugs": ["dickssporting", "walmart", "target", "rei"],
        "outlets_nombres": ["Sierra (físico)", "TJ Maxx", "Marshalls"],
        "margen_minimo_verde": 2.5,
        "margen_minimo_amarillo": 1.8,
        "top_n_scraping_default": 50,
        "dias_rotacion_esperada": None,
        "palabras_clave_default": ["sports", "outdoor", "camping", "fitness", "gym"],
        "blacklist_default": ["used", "damaged"],
    },
]


def seed_config(db):
    if db.query(ImportConfig).first():
        print("  Config ya existe, saltando.")
        return
    config = ImportConfig()
    db.add(config)
    db.commit()
    print("  Config global creada.")


def seed_retailers(db) -> dict:
    """Crea retailers y devuelve mapping slug → id."""
    existing = {r.slug: r for r in db.query(ImportRetailer).all()}
    slug_to_id = {}

    for data in RETAILERS_DATA:
        if data["slug"] in existing:
            slug_to_id[data["slug"]] = existing[data["slug"]].id
            continue

        retailer = ImportRetailer(
            id=str(uuid.uuid4()),
            nombre=data["nombre"],
            slug=data["slug"],
            tipo=data["tipo"],
            base_url=data["base_url"],
            search_url_template=data["search_url_template"],
            scraper_implementacion=data["scraper_implementacion"],
            cobra_tax_fl=data.get("cobra_tax_fl", True),
            envio_gratis_umbral=data.get("envio_gratis_umbral"),
            delay_min_ms=data.get("delay_min_ms", 2000),
            delay_max_ms=data.get("delay_max_ms", 5000),
        )
        db.add(retailer)
        db.flush()
        slug_to_id[data["slug"]] = retailer.id
        print(f"  Retailer creado: {data['nombre']}")

    db.commit()
    return slug_to_id


def seed_outlets(db) -> dict:
    """Crea outlets y devuelve mapping nombre → id."""
    existing = {o.nombre: o for o in db.query(ImportOutlet).all()}
    nombre_to_id = {}

    for data in OUTLETS_DATA:
        if data["nombre"] in existing:
            nombre_to_id[data["nombre"]] = existing[data["nombre"]].id
            continue

        outlet = ImportOutlet(
            id=str(uuid.uuid4()),
            nombre=data["nombre"],
            tipo=data["tipo"],
            ciudad=data["ciudad"],
            estado=data["estado"],
            direccion=data.get("direccion"),
            rubros_tipicos=data.get("rubros_tipicos", []),
        )
        db.add(outlet)
        db.flush()
        nombre_to_id[data["nombre"]] = outlet.id
        print(f"  Outlet creado: {data['nombre']}")

    db.commit()
    return nombre_to_id


def seed_templates(db, slug_to_id: dict, nombre_to_id: dict):
    existing = {t.nombre for t in db.query(ImportRubroTemplate).all()}

    for data in TEMPLATES_DATA:
        if data["nombre"] in existing:
            print(f"  Template ya existe: {data['nombre']}")
            continue

        retailers_ids = [slug_to_id[s] for s in data.get("retailers_slugs", []) if s in slug_to_id]
        outlets_ids = [nombre_to_id[n] for n in data.get("outlets_nombres", []) if n in nombre_to_id]

        template = ImportRubroTemplate(
            id=str(uuid.uuid4()),
            nombre=data["nombre"],
            descripcion=data.get("descripcion"),
            retailers_recomendados=retailers_ids,
            outlets_recomendados=outlets_ids,
            margen_minimo_verde=data.get("margen_minimo_verde", 2.5),
            margen_minimo_amarillo=data.get("margen_minimo_amarillo", 1.8),
            top_n_scraping_default=data.get("top_n_scraping_default", 50),
            dias_rotacion_esperada=data.get("dias_rotacion_esperada"),
            flag_restriccion=data.get("flag_restriccion"),
            palabras_clave_default=data.get("palabras_clave_default", []),
            blacklist_default=data.get("blacklist_default", []),
        )
        db.add(template)
        print(f"  Template creado: {data['nombre']}")

    db.commit()


def seed_rubros_iniciales(db):
    """Crea un rubro inicial por cada template si no existe ningún rubro."""
    if db.query(ImportRubro).count() > 0:
        print("  Rubros ya existen, saltando seed inicial.")
        return

    templates = {t.nombre: t for t in db.query(ImportRubroTemplate).all()}

    for tpl_nombre, template in templates.items():
        rubro = ImportRubro(
            id=str(uuid.uuid4()),
            nombre=tpl_nombre,
            template_id=template.id,
            retailers_activos=template.retailers_recomendados,
            outlets_activos=template.outlets_recomendados,
            margen_minimo_verde=template.margen_minimo_verde,
            margen_minimo_amarillo=template.margen_minimo_amarillo,
            top_n_scraping=template.top_n_scraping_default,
            dias_rotacion_esperada=template.dias_rotacion_esperada,
            palabras_busqueda_usa=template.palabras_clave_default,
            blacklist_palabras=template.blacklist_default,
            flag_restriccion=template.flag_restriccion,
        )
        db.add(rubro)
        print(f"  Rubro creado: {tpl_nombre}")

    db.commit()


def run():
    db = SessionLocal()
    try:
        print("\n=== Seed Import Scorer ===")
        print("\n[1/5] Config global...")
        seed_config(db)

        print("\n[2/5] Retailers...")
        slug_to_id = seed_retailers(db)
        print(f"  Total retailers: {len(slug_to_id)}")

        print("\n[3/5] Outlets...")
        nombre_to_id = seed_outlets(db)
        print(f"  Total outlets: {len(nombre_to_id)}")

        print("\n[4/5] Templates...")
        seed_templates(db, slug_to_id, nombre_to_id)

        print("\n[5/5] Rubros iniciales...")
        seed_rubros_iniciales(db)

        print("\n✓ Seed Import Scorer completado.\n")
    finally:
        db.close()


if __name__ == "__main__":
    run()
