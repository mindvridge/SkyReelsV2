"""Celery worker entry point"""

import logging
from app.services.queue import celery_app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Starting Celery worker...")
    celery_app.start()
