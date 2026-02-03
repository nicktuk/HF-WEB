"""Repository for SourceWebsite operations."""
from typing import Optional, List
from sqlalchemy.orm import Session

from app.db.repositories.base import BaseRepository
from app.models.source_website import SourceWebsite


class SourceWebsiteRepository(BaseRepository[SourceWebsite]):
    """Repository for source website operations."""

    def __init__(self, db: Session):
        super().__init__(SourceWebsite, db)

    def get_by_name(self, name: str) -> Optional[SourceWebsite]:
        """Get source website by unique name."""
        return (
            self.db.query(SourceWebsite)
            .filter(SourceWebsite.name == name)
            .first()
        )

    def get_active(self) -> List[SourceWebsite]:
        """Get all active source websites."""
        return (
            self.db.query(SourceWebsite)
            .filter(SourceWebsite.is_active == True)
            .all()
        )

    def get_by_base_url(self, base_url: str) -> Optional[SourceWebsite]:
        """Get source website by base URL."""
        return (
            self.db.query(SourceWebsite)
            .filter(SourceWebsite.base_url == base_url)
            .first()
        )

    def get_by_ids(self, ids: List[int]) -> List[SourceWebsite]:
        """Get source websites by list of IDs."""
        if not ids:
            return []
        return (
            self.db.query(SourceWebsite)
            .filter(SourceWebsite.id.in_(ids))
            .all()
        )
