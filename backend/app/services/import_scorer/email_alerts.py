"""Alertas por email para Import Scorer."""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings

logger = logging.getLogger(__name__)


def _smtp_settings_ok() -> bool:
    return bool(
        getattr(settings, "IS_EMAIL_HOST", "")
        and getattr(settings, "IS_EMAIL_USER", "")
        and getattr(settings, "IS_EMAIL_TO", "")
    )


def enviar_resumen_scraping(resultado: dict) -> None:
    """Envía email con resumen del scraping si hay configuración SMTP."""
    if not _smtp_settings_ok():
        return

    rubros = resultado.get("rubros_procesados", 0)
    actualizados = resultado.get("productos_actualizados", 0)
    errores = resultado.get("errores", 0)

    asunto = f"[Import Scorer] Scraping completado: {actualizados} productos"
    cuerpo = (
        f"<h2>Resumen de scraping</h2>"
        f"<ul>"
        f"<li>Rubros procesados: {rubros}</li>"
        f"<li>Productos actualizados: {actualizados}</li>"
        f"<li>Errores: {errores}</li>"
        f"<li>Duración: {resultado.get('duracion_ms', 0) / 1000:.1f}s</li>"
        f"</ul>"
    )
    _enviar(asunto, cuerpo)


def _enviar(asunto: str, cuerpo_html: str) -> None:
    host = getattr(settings, "IS_EMAIL_HOST", "")
    port = int(getattr(settings, "IS_EMAIL_PORT", 587))
    user = getattr(settings, "IS_EMAIL_USER", "")
    password = getattr(settings, "IS_EMAIL_PASSWORD", "")
    to_addr = getattr(settings, "IS_EMAIL_TO", "")
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
        logger.error(f"Error enviando email: {e}")
