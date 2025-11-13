"""Celery tasks for asynchronous video generation"""

import os
import logging
from datetime import datetime
from celery import Celery, Task
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.database import SessionLocal, Video
from app.services.video_generator import SkyReelsGenerator
from app.services.storage import StorageService

settings = get_settings()

# Initialize Celery
celery_app = Celery(
    "skyreels_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    task_soft_time_limit=3000,  # 50 minutes
)

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Base task class with database session"""

    _db = None

    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None


@celery_app.task(bind=True, base=DatabaseTask, name="generate_video_task")
def generate_video_task(self, job_id: str, params: dict):
    """
    Asynchronous video generation task

    Args:
        job_id: UUID of the video job
        params: Generation parameters (prompt, model_type, resolution, etc.)
    """
    db = SessionLocal()
    generator = None
    storage = None

    try:
        logger.info(f"Starting video generation task for job: {job_id}")

        # Get video job from database
        video = db.query(Video).filter(Video.id == job_id).first()
        if not video:
            raise ValueError(f"Video job not found: {job_id}")

        # Update status to processing
        video.status = "processing"
        video.progress = 0
        db.commit()

        # Update task state
        self.update_state(
            state="PROCESSING",
            meta={"progress": 0, "status": "Initializing model..."}
        )

        # Initialize services
        storage = StorageService(
            storage_type=settings.STORAGE_TYPE,
            local_path=settings.LOCAL_STORAGE_PATH,
            bucket=settings.AWS_S3_BUCKET,
            access_key_id=settings.AWS_ACCESS_KEY_ID,
            secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region=settings.AWS_REGION,
        )

        # Get temporary storage path
        temp_dir = storage.get_storage_path(job_id)

        # Initialize generator
        generator = SkyReelsGenerator(
            model_type=params["model_type"],
            resolution=params["resolution"],
            model_cache_dir=settings.SKYREELS_MODEL_CACHE,
        )

        # Update progress
        video.progress = 10
        db.commit()
        self.update_state(
            state="PROCESSING",
            meta={"progress": 10, "status": "Model loaded, starting generation..."}
        )

        # Handle image for I2V mode
        image_path = None
        if params.get("model_type") == "i2v" and params.get("image_url"):
            # In a real implementation, download the image from URL
            # For now, we'll assume the image_url is a local path or skip this
            image_path = params.get("image_url")

        # Generate video
        logger.info("Starting video generation...")
        video.progress = 20
        db.commit()
        self.update_state(
            state="PROCESSING",
            meta={"progress": 20, "status": "Generating video frames..."}
        )

        video_path = generator.generate(
            prompt=params["prompt"],
            num_frames=params.get("num_frames", 97),
            guidance_scale=params.get("guidance_scale", 6.0),
            num_inference_steps=params.get("num_inference_steps", 30),
            image_path=image_path,
            output_dir=str(temp_dir),
        )

        # Update progress
        video.progress = 70
        db.commit()
        self.update_state(
            state="PROCESSING",
            meta={"progress": 70, "status": "Video generated, creating thumbnail..."}
        )

        # Generate thumbnail
        thumbnail_path = generator.generate_thumbnail(video_path)

        # Update progress
        video.progress = 80
        db.commit()
        self.update_state(
            state="PROCESSING",
            meta={"progress": 80, "status": "Uploading files..."}
        )

        # Upload to storage
        video_url = storage.save_video(video_path, job_id)
        thumbnail_url = storage.save_thumbnail(thumbnail_path, job_id)

        # Update database
        video.status = "completed"
        video.progress = 100
        video.video_url = video_url
        video.thumbnail_url = thumbnail_url
        video.completed_at = datetime.utcnow()
        db.commit()

        logger.info(f"Video generation completed for job: {job_id}")

        return {
            "job_id": str(job_id),
            "status": "completed",
            "video_url": video_url,
            "thumbnail_url": thumbnail_url,
        }

    except Exception as e:
        logger.error(f"Error in video generation task: {e}", exc_info=True)

        # Update database with error
        try:
            video = db.query(Video).filter(Video.id == job_id).first()
            if video:
                video.status = "failed"
                video.error_message = str(e)
                db.commit()
        except Exception as db_error:
            logger.error(f"Error updating database with failure: {db_error}")

        # Re-raise exception for Celery
        raise

    finally:
        # Cleanup
        if generator:
            generator.cleanup()
        if db:
            db.close()


@celery_app.task(name="cleanup_old_videos")
def cleanup_old_videos(days: int = 7):
    """
    Cleanup old completed or failed videos

    Args:
        days: Delete videos older than this many days
    """
    db = SessionLocal()
    try:
        from datetime import timedelta

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Find old videos
        old_videos = (
            db.query(Video)
            .filter(
                Video.created_at < cutoff_date,
                Video.status.in_(["completed", "failed"]),
            )
            .all()
        )

        storage = StorageService(
            storage_type=settings.STORAGE_TYPE,
            local_path=settings.LOCAL_STORAGE_PATH,
            bucket=settings.AWS_S3_BUCKET,
            access_key_id=settings.AWS_ACCESS_KEY_ID,
            secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region=settings.AWS_REGION,
        )

        for video in old_videos:
            try:
                # Delete files
                storage.delete_files(video.id)
                # Delete database record
                db.delete(video)
                logger.info(f"Deleted old video: {video.id}")
            except Exception as e:
                logger.error(f"Error deleting video {video.id}: {e}")

        db.commit()
        logger.info(f"Cleanup completed: {len(old_videos)} videos deleted")

    except Exception as e:
        logger.error(f"Error in cleanup task: {e}")
        raise
    finally:
        db.close()
