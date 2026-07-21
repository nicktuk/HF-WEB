"""Normalización de celulares argentinos al formato usado por WhatsApp (549 + área + número)."""
import re


def normalizar_celular(valor: str) -> str:
    """Normaliza un celular argentino a '549' + área + número (sin '15', sin espacios/guiones).

    Ej: "11 5555-4444" -> "5491155554444". Idempotente: normalizar un valor ya
    normalizado devuelve el mismo valor.

    Heurística (no hay forma de saber la longitud exacta del código de área sin
    una tabla completa): tras limpiar prefijos, si quedan 12 dígitos y los
    dígitos en la posición 2..4 son "15" (formato típico "11 15-5555-4444"),
    se los quita para dejar los 10 dígitos esperados (área + número).
    """
    digits = re.sub(r"\D", "", valor or "")

    if digits.startswith("54"):
        digits = digits[2:]
    if digits.startswith("9"):
        digits = digits[1:]
    if digits.startswith("0"):
        digits = digits[1:]

    if len(digits) == 12 and digits[2:4] == "15":
        digits = digits[:2] + digits[4:]
    elif len(digits) == 13 and digits[3:5] == "15":
        digits = digits[:3] + digits[5:]
    elif len(digits) == 14 and digits[4:6] == "15":
        digits = digits[:4] + digits[6:]

    return f"549{digits}"
