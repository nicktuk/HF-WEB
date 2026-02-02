"""
Service for managing background scrape jobs.

Permite ejecutar scraping en background y consultar el progreso.
Los productos se guardan en la DB a medida que se procesan.
"""
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from dataclasses import dataclass, field
from enum import Enum
import logging
import uuid

from sqlalchemy.orm import Session

from app.models.product import Product, ProductImage
from app.models.source_website import SourceWebsite
from app.scrapers.base import ScrapedProduct
from app.scrapers.registry import ScraperRegistry
from app.services.cache import cache

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ScrapeJobProgress:
    """Tracks progress of a scrape job."""
    job_id: str
    source_name: str
    status: JobStatus = JobStatus.PENDING
    total: int = 0
    processed: int = 0
    new_products: int = 0
    updated: int = 0
    errors: int = 0
    obsolete: int = 0  # Products no longer in source
    current_product: str = ""
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None

    @property
    def progress_percent(self) -> float:
        if self.total == 0:
            return 0.0
        return round((self.processed / self.total) * 100, 1)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "source_name": self.source_name,
            "status": self.status.value,
            "total": self.total,
            "processed": self.processed,
            "new_products": self.new_products,
            "updated": self.updated,
            "errors": self.errors,
            "obsolete": self.obsolete,
            "progress_percent": self.progress_percent,
            "current_product": self.current_product,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "error_message": self.error_message,
        }


class ScrapeJobManager:
    """
    Manages background scrape jobs.

    Singleton que mantiene el estado de los jobs en memoria.
    """
    _instance = None
    _jobs: Dict[str, ScrapeJobProgress] = {}
    _tasks: Dict[str, asyncio.Task] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def get_job(self, job_id: str) -> Optional[ScrapeJobProgress]:
        """Get job progress by ID."""
        return self._jobs.get(job_id)

    def get_active_job_for_source(self, source_name: str) -> Optional[ScrapeJobProgress]:
        """Get active job for a source, if any."""
        for job in self._jobs.values():
            if job.source_name == source_name and job.status == JobStatus.RUNNING:
                return job
        return None

    def get_all_jobs(self) -> list:
        """Get all jobs."""
        return [job.to_dict() for job in self._jobs.values()]

    def create_job(self, source_name: str) -> ScrapeJobProgress:
        """Create a new job."""
        job_id = str(uuid.uuid4())[:8]
        job = ScrapeJobProgress(
            job_id=job_id,
            source_name=source_name,
        )
        self._jobs[job_id] = job
        return job

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        if job_id in self._tasks:
            self._tasks[job_id].cancel()
            if job_id in self._jobs:
                self._jobs[job_id].status = JobStatus.CANCELLED
                self._jobs[job_id].finished_at = datetime.utcnow()
            return True
        return False

    async def run_scrape_job(
        self,
        job: ScrapeJobProgress,
        db_session_factory,
        source_website_id: int,
    ):
        """
        Run a scrape job in background.

        Args:
            job: The job progress tracker
            db_session_factory: Callable that returns a new DB session
            source_website_id: ID of the source website
        """
        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()

        db: Session = db_session_factory()

        try:
            # Get source website
            source_website = db.query(SourceWebsite).filter(
                SourceWebsite.id == source_website_id
            ).first()

            if not source_website:
                raise ValueError(f"Source website {source_website_id} not found")

            # Get scraper
            scraper = ScraperRegistry.get_scraper(source_website.name)

            # For redlenic, use scrape_all_products with callbacks
            if hasattr(scraper, 'scrape_all_products'):
                def on_product(product: ScrapedProduct, idx: int, total: int):
                    job.total = total
                    job.processed = idx + 1
                    job.current_product = product.name[:50] if product.name else ""

                    # Save product to DB
                    try:
                        self._save_product(db, source_website_id, product)
                        job.new_products += 1
                    except Exception as e:
                        if "duplicate" in str(e).lower():
                            job.updated += 1
                        else:
                            job.errors += 1
                            logger.error(f"Error saving product: {e}")

                def on_progress(current: int, total: int):
                    job.processed = current
                    job.total = total

                await scraper.scrape_all_products(
                    config=source_website.scraper_config,
                    on_product=on_product,
                    on_progress=on_progress
                )
            else:
                # Fallback for other scrapers
                slugs = await scraper.scrape_catalog(config=source_website.scraper_config)
                job.total = len(slugs)

                for idx, slug in enumerate(slugs):
                    job.current_product = slug[:50]
                    try:
                        scraped = await scraper.scrape_product(slug, config=source_website.scraper_config)
                        self._save_product(db, source_website_id, scraped)
                        job.new_products += 1
                    except Exception as e:
                        job.errors += 1
                        logger.error(f"Error with {slug}: {e}")

                    job.processed = idx + 1

            # Mark obsolete products (not updated during this scrape)
            job.obsolete = self._mark_obsolete_products(
                db, source_website_id, job.started_at
            )

            job.status = JobStatus.COMPLETED
            cache.invalidate_all_products()
            logger.info(
                f"Job {job.job_id} completed: {job.new_products} new, "
                f"{job.updated} updated, {job.obsolete} obsolete, {job.errors} errors"
            )

        except asyncio.CancelledError:
            job.status = JobStatus.CANCELLED
            logger.info(f"Job {job.job_id} cancelled")
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            logger.error(f"Job {job.job_id} failed: {e}")
        finally:
            job.finished_at = datetime.utcnow()
            await scraper.close()
            db.close()

    def _save_product(self, db: Session, source_website_id: int, scraped: ScrapedProduct):
        """Save a scraped product to the database."""
        # Check if exists
        existing = db.query(Product).filter(
            Product.source_website_id == source_website_id,
            Product.slug == scraped.slug
        ).first()

        if existing:
            # Update existing
            existing.original_name = scraped.name
            if scraped.price:
                existing.original_price = Decimal(str(scraped.price))
            if scraped.sku:
                existing.sku = scraped.sku
            if scraped.categories:
                existing.category = scraped.categories[0]
            if scraped.brand:
                existing.brand = scraped.brand
            existing.last_scraped_at = datetime.utcnow()
            existing.scrape_last_error = None  # Clear any previous error
            existing.scrape_error_count = 0
            db.commit()
            raise ValueError("duplicate")  # Signal to caller this was an update

        # Create new
        product = Product(
            source_website_id=source_website_id,
            slug=scraped.slug,
            source_url=scraped.source_url,
            original_name=scraped.name,
            original_price=Decimal(str(scraped.price)) if scraped.price else None,
            description=scraped.description,
            short_description=scraped.short_description,
            brand=scraped.brand,
            sku=scraped.sku,
            enabled=False,
            is_featured=True,
            markup_percentage=Decimal("0"),
            category=scraped.categories[0] if scraped.categories else None,
            last_scraped_at=datetime.utcnow(),
        )

        db.add(product)
        db.flush()

        # Add images
        for i, img_url in enumerate(scraped.images):
            image = ProductImage(
                product_id=product.id,
                url=img_url,
                original_url=img_url,
                display_order=i,
                is_primary=(i == 0),
            )
            db.add(image)

        db.commit()

    def _mark_obsolete_products(
        self,
        db: Session,
        source_website_id: int,
        scrape_started_at: datetime
    ) -> int:
        """
        Mark products as obsolete if they weren't updated during the scrape.

        Products that existed before but weren't in the current scrape
        are disabled and marked with an error message.

        Returns the count of obsolete products.
        """
        from sqlalchemy import or_

        # Find products that weren't updated during this scrape
        # (last_scraped_at is before the job started, or is NULL)
        obsolete_products = db.query(Product).filter(
            Product.source_website_id == source_website_id,
            or_(
                Product.last_scraped_at < scrape_started_at,
                Product.last_scraped_at.is_(None)
            )
        ).all()

        count = 0
        for product in obsolete_products:
            product.enabled = False
            product.scrape_last_error = "No encontrado en catálogo origen"
            count += 1

        if count > 0:
            db.commit()
            logger.info(f"Marked {count} products as obsolete for source {source_website_id}")

        return count

    def start_job(
        self,
        source_name: str,
        source_website_id: int,
        db_session_factory,
    ) -> ScrapeJobProgress:
        """
        Start a new scrape job in background.

        Returns the job progress tracker.
        """
        # Check if there's already an active job for this source
        active = self.get_active_job_for_source(source_name)
        if active:
            return active

        job = self.create_job(source_name)

        # Create background task
        task = asyncio.create_task(
            self.run_scrape_job(job, db_session_factory, source_website_id)
        )
        self._tasks[job.job_id] = task

        return job


# Global instance
scrape_job_manager = ScrapeJobManager()
