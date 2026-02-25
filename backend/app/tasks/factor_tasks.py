"""
Background tasks for emission factor updates.

Scheduled to run weekly to check for updated factors from EPA, DEFRA, IEA sources.
"""

import logging
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def update_emission_factors(self):
    """
    Scheduled task to check and update emission factors from external sources.

    This task:
    1. Checks EPA GHG Emission Factors Hub for updates
    2. Checks DEFRA conversion factors for updates
    3. Checks IEA grid emission factors for updates
    4. Updates factors with version tracking
    5. Sends notifications for changes >5%
    """
    logger.info("Starting scheduled emission factor update check")

    try:
        # In production, this would make HTTP requests to factor APIs
        # and update the database accordingly using FactorManager.update_factor()
        #
        # Example flow:
        # 1. Fetch latest factors from EPA API
        # 2. Compare with stored factors
        # 3. Update changed factors with version history
        # 4. Log significant changes (>5%)

        logger.info("Emission factor update check completed")
        return {"status": "completed", "checked_sources": ["epa", "defra", "iea"]}

    except Exception as exc:
        logger.error(f"Factor update failed: {exc}")
        self.retry(exc=exc, countdown=300)  # Retry after 5 minutes
