"""Optimizador greedy de carrito con restricciones de peso y capital."""
from typing import List, Dict, Any


def optimizar_carrito(
    productos: List[Dict[str, Any]],
    peso_max_kg: float,
    capital_max_usd: float,
    peso_min_kg: float = 15.0,
) -> Dict[str, Any]:
    """
    Selecciona el conjunto de productos (con sus cantidades) que maximiza el ratio
    de margen total sin exceder las restricciones de peso y capital.

    Cada producto debe tener: id, nombre, costo_puesto_usd, peso_kg,
    ratio_margen, semaforo, cantidad_sugerida (opcional).

    Algoritmo: greedy por ratio_margen / peso_kg descendente.
    """
    candidatos = [
        p for p in productos
        if p.get("costo_puesto_usd") and p.get("peso_kg")
        and p.get("semaforo") in ("verde", "amarillo")
        and not p.get("descartado", False)
    ]

    # Ordenar por densidad de valor (ratio / kg)
    candidatos.sort(
        key=lambda p: (p.get("ratio_margen") or 0) / max(p.get("peso_kg", 1), 0.1),
        reverse=True,
    )

    seleccionados: List[Dict[str, Any]] = []
    peso_total = 0.0
    capital_total = 0.0

    for p in candidatos:
        cantidad_sugerida = max(1, p.get("cantidad_sugerida") or 1)
        costo_unit = p["costo_puesto_usd"]
        peso_unit = p["peso_kg"]

        if peso_unit <= 0 or costo_unit <= 0:
            continue

        cant_max_peso = int((peso_max_kg - peso_total) / peso_unit)
        cant_max_cap = int((capital_max_usd - capital_total) / costo_unit)
        cant_real = min(cantidad_sugerida, cant_max_peso, cant_max_cap)

        if cant_real <= 0:
            continue

        seleccionados.append({
            "id": p["id"],
            "nombre": p.get("nombre", ""),
            "cantidad": cant_real,
            "precio_usd_locked": p.get("mejor_precio_usd") or costo_unit,
            "peso_kg_locked": peso_unit,
            "costo_puesto_usd": costo_unit,
            "ratio_margen": p.get("ratio_margen"),
            "semaforo": p.get("semaforo"),
        })
        peso_total += peso_unit * cant_real
        capital_total += costo_unit * cant_real

        if peso_total >= peso_max_kg * 0.97:
            break

    return {
        "items": seleccionados,
        "peso_total_kg": round(peso_total, 3),
        "capital_total_usd": round(capital_total, 2),
        "n_productos": len(seleccionados),
        "alcanza_minimo": peso_total >= peso_min_kg,
    }
