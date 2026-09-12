"""Recuperación de contraseña del canal comercios: tokens de reset, OTP y mails."""
import hashlib
import logging
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)

RESET_TOKEN_TTL_MINUTES = 60

# Sin 0/O/1/I/L para poder dictarla por WhatsApp sin ambigüedad.
_OTP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generar_token_reset() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generar_otp(length: int = 8) -> str:
    return "".join(secrets.choice(_OTP_ALPHABET) for _ in range(length))


def _smtp_settings_ok() -> bool:
    return bool(
        getattr(settings, "IS_EMAIL_HOST", "")
        and getattr(settings, "IS_EMAIL_USER", "")
    )


def _enviar(to_addr: str, asunto: str, cuerpo_html: str) -> None:
    if not to_addr or not _smtp_settings_ok():
        return

    host = getattr(settings, "IS_EMAIL_HOST", "")
    port = int(getattr(settings, "IS_EMAIL_PORT", 587))
    user = getattr(settings, "IS_EMAIL_USER", "")
    password = getattr(settings, "IS_EMAIL_PASSWORD", "")
    from_addr = getattr(settings, "IS_EMAIL_FROM", user)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = asunto
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.attach(MIMEText(cuerpo_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.ehlo()
            if port == 587:
                smtp.starttls()
            if user and password:
                smtp.login(user, password)
            smtp.sendmail(from_addr, to_addr, msg.as_string())
        logger.info(f"Email enviado a {to_addr}: {asunto}")
    except Exception as e:
        logger.error(f"Error enviando email a {to_addr}: {e}")


def enviar_mail_reset(comercio, token: str) -> None:
    base_url = getattr(settings, "NEXT_PUBLIC_BASE_URL", "")
    link = f"{base_url}/comercios/reset-password?token={token}"
    asunto = "Reestablecé tu contraseña — HEFA Comercios"
    cuerpo = (
        f"<p>Hola {comercio.nombre},</p>"
        f"<p>Recibimos un pedido para reestablecer la contraseña de tu cuenta "
        f"<strong>{comercio.usuario}</strong> en el canal de comercios de HEFA.</p>"
        f'<p><a href="{link}">Hacé clic acá para elegir una nueva contraseña</a></p>'
        f"<p>El link vence en {RESET_TOKEN_TTL_MINUTES} minutos. Si no pediste esto, "
        f"podés ignorar este mail.</p>"
    )
    _enviar(comercio.email, asunto, cuerpo)


def enviar_alerta_sin_email(comercio) -> None:
    to_addr = getattr(settings, "COMERCIO_ALERT_EMAIL_TO", "") or getattr(settings, "IS_EMAIL_TO", "")
    asunto = f"[Comercios] {comercio.usuario} pidió resetear contraseña sin email registrado"
    cuerpo = (
        f"<h3>Solicitud de reset sin email</h3>"
        f"<ul>"
        f"<li>Usuario: {comercio.usuario}</li>"
        f"<li>Nombre: {comercio.nombre} {comercio.apellido}</li>"
        f"<li>Local: {comercio.nombre_local}</li>"
        f"<li>Celular: {comercio.celular or '(sin celular)'}</li>"
        f"</ul>"
        f"<p>No tiene email cargado, así que no se le pudo enviar un link de reset. "
        f"Contactalo y asignale una contraseña temporal desde /admin/comercios.</p>"
    )
    _enviar(to_addr, asunto, cuerpo)
