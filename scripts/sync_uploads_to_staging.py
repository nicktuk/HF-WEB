#!/usr/bin/env python3
"""
Sincroniza el volumen de uploads de producción → staging.

Cómo funciona:
  1. Consulta la API pública de staging para obtener todas las URLs de imágenes.
  2. Por cada URL que apunte al backend de producción, extrae el filename.
  3. Descarga el archivo desde producción.
  4. Lo sube al backend de staging con el mismo nombre usando el endpoint /upload/sync-from-url.

Uso:
  python scripts/sync_uploads_to_staging.py

Requisitos:
  pip install httpx
"""

import httpx
import re
import sys

# ── Configuración ────────────────────────────────────────────────
PROD_BACKEND   = "https://hf-web-production.up.railway.app"
STAGING_BACKEND = "https://hf-web-back-staging.up.railway.app"
STAGING_API_KEY = "busH8sDsncfrB391P_JePMCiix_yFKPNWbuPtvbOlos"   # <── completar con el ADMIN_API_KEY de staging
# ─────────────────────────────────────────────────────────────────

if not STAGING_API_KEY:
    print("ERROR: completá STAGING_API_KEY en el script.")
    sys.exit(1)

headers = {"X-Admin-API-Key": STAGING_API_KEY}


def get_all_image_urls() -> set[str]:
    """Recolecta todas las URLs de imágenes desde la API pública de staging."""
    urls: set[str] = set()

    # Productos
    with httpx.Client(timeout=30) as client:
        r = client.get(f"{STAGING_BACKEND}/api/v1/public/products?page=1&limit=5000")
        r.raise_for_status()
        products = r.json().get("items", [])
        for p in products:
            for img in p.get("images", []):
                if img.get("url"):
                    urls.add(img["url"])

        # Secciones
        r = client.get(f"{STAGING_BACKEND}/api/v1/sections/public")
        if r.status_code == 200:
            sections = r.json()
            for s in sections:
                if s.get("image_url"):
                    urls.add(s["image_url"])

    return urls


def extract_filename(url: str) -> str | None:
    """Extrae el nombre de archivo de una URL de /uploads/."""
    m = re.search(r"/uploads/([^/?#]+)", url)
    return m.group(1) if m else None


def source_url_for(filename: str) -> str:
    return f"{PROD_BACKEND}/uploads/{filename}"


def sync_file(filename: str) -> str:
    """Envía el filename al endpoint de staging para que lo descargue desde prod."""
    with httpx.Client(timeout=60) as client:
        r = client.post(
            f"{STAGING_BACKEND}/api/v1/admin/upload/sync-from-url",
            json={"filename": filename, "url": source_url_for(filename)},
            headers=headers,
        )
        r.raise_for_status()
        return r.json().get("status", "?")


def main():
    print("Obteniendo URLs de imágenes desde staging...")
    all_urls = get_all_image_urls()
    print(f"  {len(all_urls)} URLs encontradas")

    uploads_urls = [u for u in all_urls if "/uploads/" in u]
    print(f"  {len(uploads_urls)} son de /uploads/")

    if not uploads_urls:
        print("No hay nada para sincronizar.")
        return

    ok = skipped = errors = 0
    for url in uploads_urls:
        filename = extract_filename(url)
        if not filename:
            continue
        try:
            status = sync_file(filename)
            if status == "already_exists":
                skipped += 1
                print(f"  skip  {filename}")
            else:
                ok += 1
                print(f"  ok    {filename}")
        except Exception as e:
            errors += 1
            print(f"  ERROR {filename}: {e}")

    print(f"\nListo: {ok} copiados, {skipped} ya existían, {errors} errores.")


if __name__ == "__main__":
    main()
