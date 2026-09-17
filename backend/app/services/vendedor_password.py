"""Recuperación de contraseña del portal de vendedores: mails de reset/alerta.

Los helpers genéricos (token de reset, hash, OTP) viven en comercio_password
y se reutilizan tal cual — no son específicos del canal comercios.
"""
from app.config import settings
from app.services.comercio_password import RESET_TOKEN_TTL_MINUTES, _enviar  # noqa: F401 (re-exportado)


def enviar_mail_reset(vendedor, token: str) -> None:
    base_url = getattr(settings, "NEXT_PUBLIC_BASE_URL", "")
    link = f"{base_url}/vendedores/reset-password?token={token}"
    asunto = "Reestablecé tu contraseña — HEFA Vendedores"
    cuerpo = (
        f"<p>Hola {vendedor.nombre},</p>"
        f"<p>Recibimos un pedido para reestablecer la contraseña de tu cuenta "
        f"<strong>{vendedor.usuario}</strong> en el portal de vendedores de HEFA.</p>"
        f'<p><a href="{link}">Hacé clic acá para elegir una nueva contraseña</a></p>'
        f"<p>El link vence en {RESET_TOKEN_TTL_MINUTES} minutos. Si no pediste esto, "
        f"podés ignorar este mail.</p>"
    )
    _enviar(vendedor.email, asunto, cuerpo)


def enviar_alerta_sin_email(vendedor) -> None:
    to_addr = getattr(settings, "COMERCIO_ALERT_EMAIL_TO", "") or getattr(settings, "IS_EMAIL_TO", "")
    asunto = f"[Vendedores] {vendedor.usuario} pidió resetear contraseña sin email registrado"
    cuerpo = (
        f"<h3>Solicitud de reset sin email</h3>"
        f"<ul>"
        f"<li>Usuario: {vendedor.usuario}</li>"
        f"<li>Nombre: {vendedor.nombre}</li>"
        f"<li>Celular: {vendedor.celular or '(sin celular)'}</li>"
        f"</ul>"
        f"<p>No tiene email cargado, así que no se le pudo enviar un link de reset. "
        f"Contactalo y asignale una contraseña temporal desde /admin/vendedores.</p>"
    )
    _enviar(to_addr, asunto, cuerpo)
