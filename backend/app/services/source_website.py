"""Service for SourceWebsite operations."""
from typing import Optional, List
from sqlalchemy.orm import Session

from app.db.repositories import SourceWebsiteRepository
from app.models.source_website import SourceWebsite
from app.schemas.source_website import SourceWebsiteCreate, SourceWebsiteUpdate
from app.core.exceptions import NotFoundError, DuplicateError


class SourceWebsiteService:
    """Business logic for source website operations."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = SourceWebsiteRepository(db)

    def get_all(self, active_only: bool = False) -> List[SourceWebsite]:
        """Get all source websites."""
        if active_only:
            return self.repo.get_active()
        return self.repo.get_all()

    def get_by_id(self, id: int) -> SourceWebsite:
        """Get source website by ID."""
        website = self.repo.get(id)
        if not website:
            raise NotFoundError("SourceWebsite", str(id))
        return website

    def get_by_name(self, name: str) -> Optional[SourceWebsite]:
        """Get source website by name."""
        return self.repo.get_by_name(name)

    def create(self, data: SourceWebsiteCreate) -> SourceWebsite:
        """Create a new source website."""
        # Check for duplicate name
        existing = self.repo.get_by_name(data.name)
        if existing:
            raise DuplicateError("SourceWebsite", data.name)

        # Check for duplicate URL
        existing_url = self.repo.get_by_base_url(data.base_url)
        if existing_url:
            raise DuplicateError("SourceWebsite", data.base_url)

        website = SourceWebsite(
            name=data.name,
            display_name=data.display_name,
            base_url=data.base_url,
            is_active=data.is_active,
            scraper_config=data.scraper_config.model_dump() if data.scraper_config else None,
            notes=data.notes,
        )

        return self.repo.create(website)

    def update(self, id: int, data: SourceWebsiteUpdate) -> SourceWebsite:
        """Update a source website."""
        website = self.get_by_id(id)

        # Update fields
        if data.display_name is not None:
            website.display_name = data.display_name
        if data.base_url is not None:
            website.base_url = data.base_url
        if data.is_active is not None:
            website.is_active = data.is_active
        if data.scraper_config is not None:
            website.scraper_config = data.scraper_config.model_dump()
        if data.notes is not None:
            website.notes = data.notes

        return self.repo.update(website)

    def delete(self, id: int) -> None:
        """Delete a source website."""
        website = self.get_by_id(id)
        self.repo.delete(website)
