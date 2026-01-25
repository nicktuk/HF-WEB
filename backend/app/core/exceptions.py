"""Custom exceptions for the application."""
from typing import Optional


class AppException(Exception):
    """Base exception for application errors."""

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        status_code: int = 400
    ):
        self.message = message
        self.code = code or "error"
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppException):
    """Resource not found."""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            message=f"{resource} with identifier '{identifier}' not found",
            code="not_found",
            status_code=404
        )


class ValidationError(AppException):
    """Validation error."""

    def __init__(self, message: str, field: Optional[str] = None):
        code = f"validation_error.{field}" if field else "validation_error"
        super().__init__(message=message, code=code, status_code=422)


class ScraperError(AppException):
    """Error during web scraping."""

    def __init__(self, message: str, source: Optional[str] = None):
        code = f"scraper_error.{source}" if source else "scraper_error"
        super().__init__(message=message, code=code, status_code=502)


class AuthenticationError(AppException):
    """Authentication failed."""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message=message, code="authentication_error", status_code=401)


class RateLimitError(AppException):
    """Rate limit exceeded."""

    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message=message, code="rate_limit_exceeded", status_code=429)


class DuplicateError(AppException):
    """Duplicate resource."""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            message=f"{resource} with identifier '{identifier}' already exists",
            code="duplicate",
            status_code=409
        )
