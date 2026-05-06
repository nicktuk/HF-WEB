"""Lógica de cálculo de costos y scoring para Import Scorer."""
from typing import Optional


def calcular_costo_puesto(
    precio_usd: float,
    peso_kg: float,
    cobra_tax_fl: bool = True,
    sales_tax_fl: float = 0.07,
    costo_flete_usd_por_kg: float = 50.0,
) -> dict:
    """
    Calcula el costo total puesto en Argentina para un producto.

    Retorna un dict con los componentes desglosados.
    """
    tax_usd = precio_usd * sales_tax_fl if cobra_tax_fl else 0.0
    subtotal_con_tax = precio_usd + tax_usd
    flete_usd = peso_kg * costo_flete_usd_por_kg
    costo_puesto = subtotal_con_tax + flete_usd

    return {
        "precio_usd": precio_usd,
        "sales_tax_usd": round(tax_usd, 2),
        "subtotal_con_tax_usd": round(subtotal_con_tax, 2),
        "costo_flete_usd": round(flete_usd, 2),
        "costo_puesto_usd": round(costo_puesto, 2),
    }


def calcular_ratio_margen(
    precio_venta_ars: float,
    costo_puesto_usd: float,
    cotizacion_mep: float,
) -> Optional[float]:
    """
    Ratio de margen = precio_venta_ARS / (costo_puesto_USD × cotizacion_MEP).

    Un ratio de 2.5x significa que el precio de venta es 2.5 veces el costo.
    """
    if costo_puesto_usd <= 0 or cotizacion_mep <= 0:
        return None
    costo_puesto_ars = costo_puesto_usd * cotizacion_mep
    if costo_puesto_ars <= 0:
        return None
    return round(precio_venta_ars / costo_puesto_ars, 3)


def calcular_semaforo(
    ratio: Optional[float],
    margen_minimo_verde: float = 2.5,
    margen_minimo_amarillo: float = 1.8,
) -> str:
    """Devuelve 'verde', 'amarillo' o 'rojo' según el ratio y los umbrales del rubro."""
    if ratio is None:
        return "rojo"
    if ratio >= margen_minimo_verde:
        return "verde"
    if ratio >= margen_minimo_amarillo:
        return "amarillo"
    return "rojo"


def calcular_resumen_carrito(
    items: list,
    cotizacion_mep: float,
    costo_flete_usd_por_kg: float = 50.0,
    sales_tax_fl: float = 0.07,
) -> dict:
    """
    Calcula el resumen completo de un carrito.
    Cada item debe tener: precio_usd_locked, peso_kg_locked, cantidad, cobra_tax_fl (del retailer).
    """
    subtotal_productos = sum(i["precio_usd_locked"] * i["cantidad"] for i in items)
    subtotal_tax = sum(
        i["precio_usd_locked"] * i["cantidad"] * sales_tax_fl
        for i in items
        if i.get("cobra_tax_fl", True)
    )
    peso_total = sum(i["peso_kg_locked"] * i["cantidad"] for i in items)
    costo_flete = peso_total * costo_flete_usd_por_kg
    costo_total_usd = subtotal_productos + subtotal_tax + costo_flete

    precio_venta_total_ars = sum(
        i.get("precio_venta_ars", 0) * i["cantidad"] for i in items
    )
    margen_bruto_usd = precio_venta_total_ars / cotizacion_mep - costo_total_usd if cotizacion_mep > 0 else None
    ratio_envio = (
        precio_venta_total_ars / (costo_total_usd * cotizacion_mep)
        if costo_total_usd > 0 and cotizacion_mep > 0
        else None
    )

    return {
        "subtotal_productos_usd": round(subtotal_productos, 2),
        "sales_tax_usd": round(subtotal_tax, 2),
        "subtotal_con_tax_usd": round(subtotal_productos + subtotal_tax, 2),
        "peso_total_kg": round(peso_total, 3),
        "costo_flete_usd": round(costo_flete, 2),
        "costo_total_usd": round(costo_total_usd, 2),
        "costo_total_ars": round(costo_total_usd * cotizacion_mep, 0) if cotizacion_mep > 0 else None,
        "precio_venta_total_ars": round(precio_venta_total_ars, 0),
        "margen_bruto_usd": round(margen_bruto_usd, 2) if margen_bruto_usd is not None else None,
        "ratio_envio": round(ratio_envio, 3) if ratio_envio is not None else None,
        "semaforo_envio": calcular_semaforo(ratio_envio) if ratio_envio is not None else "rojo",
    }


def calcular_alertas_carrito(resumen: dict, items: list) -> list:
    """Genera lista de alertas para el panel lateral del carrito."""
    alertas = []
    peso = resumen.get("peso_total_kg", 0)
    ratio = resumen.get("ratio_envio")

    if peso < 15:
        alertas.append({
            "tipo": "rojo",
            "mensaje": f"Peso total bajo ({peso:.1f} kg). Mínimo recomendado 15 kg.",
            "accion": "sugerir_productos",
        })
    elif peso > 60:
        alertas.append({
            "tipo": "amarillo",
            "mensaje": f"Peso alto ({peso:.1f} kg). Considerá dividir el carrito.",
            "accion": "dividir_carrito",
        })

    if ratio is not None and ratio < 1.8:
        alertas.append({
            "tipo": "rojo",
            "mensaje": f"Ratio {ratio:.1f}x (rojo). Revisá los productos de bajo margen.",
            "accion": "eliminar_rojos",
        })

    for item in items:
        if item.get("en_clearance"):
            alertas.append({
                "tipo": "warning",
                "mensaje": f"{item.get('nombre', 'Producto')} en clearance, puede agotarse.",
                "accion": "ver_producto",
                "producto_id": item.get("producto_id"),
            })

    return alertas
