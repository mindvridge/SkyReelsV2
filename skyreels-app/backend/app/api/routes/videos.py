"""Video generation API endpoints"""

import logging
from uuid import UUID
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import Video, get_db
from app.models.schemas import (
    VideoCreate,
    VideoResponse,
    VideoListResponse,
    JobCreatedResponse,
    MessageResponse,
    VideoStatus,
)
from app.services.queue import generate_video_task, celery_app
from app.services.storage import StorageService
from app.config import get_settings, Settings

router = APIRouter(prefix="/videos", tags=["videos"])
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=JobCreatedResponse, status_code=202)
async def generate_video(
    request: VideoCreate,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Create a new video generation job

    This endpoint queues a video generation task and returns immediately.
    Use the job_id to poll for status updates.

    Args:
        request: Video generation parameters

    Returns:
        Job information including job_id for status polling
    """
    try:
        # Validate I2V requirements
        if request.model_type.value == "i2v" and not request.image_url:
            raise HTTPException(
                status_code=400,
                detail="image_url is required for Image-to-Video (I2V) mode",
            )

        # Create database record
        video = Video(
            prompt=request.prompt,
            model_type=request.model_type.value,
            model_size=request.model_size.value,
            resolution=request.resolution.value,
            num_frames=request.num_frames,
            guidance_scale=request.guidance_scale,
            num_inference_steps=request.num_inference_steps,
            image_url=str(request.image_url) if request.image_url else None,
            status="queued",
            progress=0,
        )

        db.add(video)
        db.commit()
        db.refresh(video)

        logger.info(f"Created video job: {video.id} (model: {request.model_size.value})")

        # Queue Celery task
        task_params = {
            "prompt": request.prompt,
            "model_type": request.model_type.value,
            "model_size": request.model_size.value,
            "resolution": request.resolution.value,
            "num_frames": request.num_frames,
            "guidance_scale": request.guidance_scale,
            "num_inference_steps": request.num_inference_steps,
            "image_url": str(request.image_url) if request.image_url else None,
        }

        generate_video_task.apply_async(
            args=[str(video.id), task_params],
            task_id=str(video.id),
        )

        logger.info(f"Queued Celery task for job: {video.id}")

        return JobCreatedResponse(
            job_id=str(video.id),
            status=VideoStatus.QUEUED,
            created_at=video.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating video job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create video job: {str(e)}")


@router.get("/status/{job_id}", response_model=VideoResponse)
async def get_video_status(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Get status of a video generation job

    Args:
        job_id: UUID of the video job

    Returns:
        Current status, progress, and video URL (if completed)
    """
    try:
        video = db.query(Video).filter(Video.id == job_id).first()

        if not video:
            raise HTTPException(status_code=404, detail="Video job not found")

        return VideoResponse(
            id=str(video.id),
            prompt=video.prompt,
            model_type=video.model_type,
            model_size=video.model_size,
            resolution=video.resolution,
            num_frames=video.num_frames,
            guidance_scale=video.guidance_scale,
            status=VideoStatus(video.status),
            progress=video.progress,
            video_url=video.video_url,
            thumbnail_url=video.thumbnail_url,
            error_message=video.error_message,
            created_at=video.created_at,
            updated_at=video.updated_at,
            completed_at=video.completed_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting video status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get video status: {str(e)}")


@router.get("/list", response_model=VideoListResponse)
async def list_videos(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    status: Optional[VideoStatus] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
):
    """
    List all video generation jobs with pagination

    Args:
        page: Page number (starting from 1)
        limit: Number of items per page
        status: Optional status filter

    Returns:
        Paginated list of video jobs
    """
    try:
        # Build query
        query = db.query(Video)

        # Apply status filter
        if status:
            query = query.filter(Video.status == status.value)

        # Get total count
        total = query.count()

        # Apply pagination
        offset = (page - 1) * limit
        videos = query.order_by(desc(Video.created_at)).offset(offset).limit(limit).all()

        # Convert to response models
        video_responses = [
            VideoResponse(
                id=str(video.id),
                prompt=video.prompt,
                model_type=video.model_type,
                model_size=video.model_size,
                resolution=video.resolution,
                num_frames=video.num_frames,
                guidance_scale=video.guidance_scale,
                status=VideoStatus(video.status),
                progress=video.progress,
                video_url=video.video_url,
                thumbnail_url=video.thumbnail_url,
                error_message=video.error_message,
                created_at=video.created_at,
                updated_at=video.updated_at,
                completed_at=video.completed_at,
            )
            for video in videos
        ]

        total_pages = (total + limit - 1) // limit

        return VideoListResponse(
            videos=video_responses,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )

    except Exception as e:
        logger.error(f"Error listing videos: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list videos: {str(e)}")


@router.delete("/{job_id}", response_model=MessageResponse)
async def delete_video(
    job_id: UUID,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Delete a video and its associated files

    Args:
        job_id: UUID of the video job

    Returns:
        Success message
    """
    try:
        video = db.query(Video).filter(Video.id == job_id).first()

        if not video:
            raise HTTPException(status_code=404, detail="Video job not found")

        # Delete files from storage
        storage = StorageService(
            storage_type=settings.STORAGE_TYPE,
            local_path=settings.LOCAL_STORAGE_PATH,
            bucket=settings.AWS_S3_BUCKET,
            access_key_id=settings.AWS_ACCESS_KEY_ID,
            secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region=settings.AWS_REGION,
        )

        storage.delete_files(job_id)

        # Delete database record
        db.delete(video)
        db.commit()

        logger.info(f"Deleted video job: {job_id}")

        return MessageResponse(message="Video deleted successfully")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting video: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete video: {str(e)}")


@router.post("/cancel-all", response_model=MessageResponse)
async def cancel_all_videos(
    db: Session = Depends(get_db),
):
    """
    Cancel all active video generation jobs (queued or processing)

    Returns:
        Success message with count of cancelled jobs
    """
    try:
        # Find all active jobs
        active_videos = db.query(Video).filter(
            Video.status.in_(["queued", "processing"])
        ).all()

        if not active_videos:
            return MessageResponse(message="No active jobs to cancel")

        cancelled_count = 0
        errors = []

        for video in active_videos:
            try:
                # Revoke Celery task
                try:
                    celery_app.control.revoke(str(video.id), terminate=True)
                    logger.info(f"Revoked Celery task for job: {video.id}")
                except Exception as e:
                    logger.warning(f"Error revoking Celery task for {video.id}: {e}")

                # Update database
                video.status = "failed"
                video.error_message = "Cancelled by user (bulk cancel)"
                video.updated_at = datetime.utcnow()
                cancelled_count += 1
            except Exception as e:
                logger.error(f"Error cancelling video {video.id}: {e}")
                errors.append(str(video.id))

        db.commit()

        message = f"Successfully cancelled {cancelled_count} job(s)"
        if errors:
            message += f". Errors with {len(errors)} job(s): {', '.join(errors)}"

        logger.info(f"Cancelled {cancelled_count} video job(s)")

        return MessageResponse(message=message)

    except Exception as e:
        logger.error(f"Error cancelling all videos: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to cancel all videos: {str(e)}")


@router.post("/{job_id}/cancel", response_model=MessageResponse)
async def cancel_video(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Cancel a video generation job

    Args:
        job_id: UUID of the video job

    Returns:
        Success message
    """
    try:
        video = db.query(Video).filter(Video.id == job_id).first()

        if not video:
            raise HTTPException(status_code=404, detail="Video job not found")

        # Only allow cancellation of queued or processing jobs
        if video.status not in ["queued", "processing"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel job with status: {video.status}"
            )

        # Revoke Celery task
        try:
            celery_app.control.revoke(str(job_id), terminate=True)
            logger.info(f"Revoked Celery task for job: {job_id}")
        except Exception as e:
            logger.warning(f"Error revoking Celery task: {e}")

        # Update database
        video.status = "failed"
        video.error_message = "Cancelled by user"
        video.updated_at = datetime.utcnow()
        db.commit()

        logger.info(f"Cancelled video job: {job_id}")

        return MessageResponse(message="Video generation cancelled successfully")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling video: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to cancel video: {str(e)}")


@router.get("/{job_id}", response_model=VideoResponse)
async def get_video(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Get detailed information about a specific video

    Args:
        job_id: UUID of the video job

    Returns:
        Complete video information
    """
    return await get_video_status(job_id, db)
