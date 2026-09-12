"""Hashing de contraseñas compartido por los endpoints de comercio (público, protegido y admin)."""
import bcrypt as _bcrypt

# Hash dummy hardcodeado para timing-safe comparison cuando el usuario no existe.
# Evita inicializar bcrypt en tiempo de import (incompatible con bcrypt>=4.0 + passlib).
DUMMY_HASH = b"$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode()[:72], _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode()[:72], hashed.encode())
    except Exception:
        return False
