"""Celery tasks for asynchronous video generation"""

import os
import sys
import logging
import torch
from datetime import datetime, timedelta
from celery import Celery, Task
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.database import SessionLocal, Video
from app.services.storage import StorageService

# MPS 호환성 패치를 queue.py에서도 적용 (Celery worker가 이미 diffusers를 import한 경우 대비)
if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    try:
        # 이미 import된 관련 모듈들을 삭제하고 다시 로드
        modules_to_reload = [
            'diffusers.models.embeddings',
            'diffusers.models.transformers.transformer_skyreels_v2',
            'diffusers.models.transformers',
        ]
        
        for module_name in modules_to_reload:
            if module_name in sys.modules:
                del sys.modules[module_name]
        
        # diffusers.models.embeddings를 직접 import하여 패치
        import diffusers.models.embeddings as embeddings_module
        
        # 원본 함수 저장
        _original_get_1d_sincos_pos_embed_from_grid = embeddings_module.get_1d_sincos_pos_embed_from_grid
        
        def _patched_get_1d_sincos_pos_embed_from_grid(embed_dim, pos, output_type="pt", flip_sin_to_cos=False):
            """MPS 호환성을 위해 float64를 float32로 변환"""
            if output_type == "np":
                return _original_get_1d_sincos_pos_embed_from_grid(embed_dim, pos, output_type="np", flip_sin_to_cos=flip_sin_to_cos)
            
            if embed_dim % 2 != 0:
                raise ValueError("embed_dim must be divisible by 2")
            
            if hasattr(pos, 'device') and pos.device.type == "mps":
                pos = pos.float()
            
            omega = torch.arange(embed_dim // 2, device=pos.device, dtype=torch.float32)
            omega /= embed_dim / 2.0
            omega = 1.0 / (10000 ** omega)
            
            pos = pos.reshape(-1)
            out = torch.outer(pos, omega)
            
            emb_sin = torch.sin(out)
            emb_cos = torch.cos(out)
            
            emb = torch.concat([emb_sin, emb_cos], dim=1)
            
            if flip_sin_to_cos:
                emb = torch.cat([emb[:, embed_dim // 2 :], emb[:, : embed_dim // 2]], dim=1)
            
            return emb
        
        # 함수 패치 적용
        embeddings_module.get_1d_sincos_pos_embed_from_grid = _patched_get_1d_sincos_pos_embed_from_grid
        
        # sys.modules에서도 업데이트
        if 'diffusers.models.embeddings' in sys.modules:
            sys.modules['diffusers.models.embeddings'].get_1d_sincos_pos_embed_from_grid = _patched_get_1d_sincos_pos_embed_from_grid
        
        if 'diffusers.models' in sys.modules:
            if hasattr(sys.modules['diffusers.models'], 'embeddings'):
                sys.modules['diffusers.models'].embeddings.get_1d_sincos_pos_embed_from_grid = _patched_get_1d_sincos_pos_embed_from_grid
        
        # diffusers.models.transformers 모듈에서도 업데이트
        # transformer_skyreels_v2 모듈이 이미 import한 함수 참조를 업데이트
        try:
            import importlib
            # transformer 모듈을 강제로 다시 로드
            if 'diffusers.models.transformers.transformer_skyreels_v2' in sys.modules:
                importlib.reload(sys.modules['diffusers.models.transformers.transformer_skyreels_v2'])
            
            # transformer 모듈을 import하고 내부의 함수 참조 업데이트
            import diffusers.models.transformers.transformer_skyreels_v2 as transformer_module
            # 모듈 내부에서 직접 import한 경우를 대비하여 모듈의 __dict__를 확인
            for attr_name in dir(transformer_module):
                attr = getattr(transformer_module, attr_name)
                # 함수가 get_1d_sincos_pos_embed_from_grid를 참조하는 경우 업데이트
                if callable(attr) and hasattr(attr, '__globals__'):
                    try:
                        if 'get_1d_sincos_pos_embed_from_grid' in attr.__globals__:
                            attr.__globals__['get_1d_sincos_pos_embed_from_grid'] = _patched_get_1d_sincos_pos_embed_from_grid
                    except:
                        pass
        except Exception as transformer_error:
            logging.getLogger(__name__).warning(f"Transformer 모듈 패치 중 오류 (계속 진행): {transformer_error}")
        
        logging.getLogger(__name__).info("✅ [queue.py] MPS 호환성 패치 적용됨 (float64 -> float32 변환)")
        # 참고: scaled_dot_product_attention 패치는 video_generator.py에서 이미 적용됨
    except Exception as e:
        logging.getLogger(__name__).warning(f"⚠️  [queue.py] MPS 호환성 패치 적용 실패: {e}")

# video_generator를 패치 적용 후에 import
from app.services.video_generator import SkyReelsGenerator

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

        # Record start time for ETA calculation
        start_time = datetime.utcnow()
        
        # Update status to processing and set initial progress to 1% IMMEDIATELY
        # This must happen before any heavy operations to show progress
        video.status = "processing"
        video.progress = 1
        video.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(video)  # Ensure the update is persisted
        logger.info(f"[Progress] Job {job_id}: 1% - Task started")

        # Update task state immediately (before any heavy operations)
        # Device info will be added after generator initialization
        self.update_state(
            state="PROCESSING",
            meta={
                "progress": 1,
                "status": "작업 시작",
                "status_detail": "비디오 생성 작업을 시작합니다...",
                "elapsed_seconds": 0,
                "estimated_remaining_seconds": None,
                "device": None  # Will be updated after generator init
            }
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

        # Update progress before model loading (3%)
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        video.progress = 3
        video.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"[Progress] Job {job_id}: 3% - Preparing model loading...")
        self.update_state(
            state="PROCESSING",
            meta={
                "progress": 3,
                "status": "모델 준비 중",
                "status_detail": "AI 모델을 준비하고 있습니다...",
                "elapsed_seconds": int(elapsed),
                "estimated_remaining_seconds": None,
                "device": None  # Will be updated after generator init
            }
        )

        # Initialize generator (this may take a long time)
        # Update progress to 5% before starting model loading
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        video.progress = 5
        video.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"[Progress] Job {job_id}: 5% - Starting model loading...")
        self.update_state(
            state="PROCESSING",
            meta={
                "progress": 5,
                "status": "모델 로딩 중",
                "status_detail": "AI 모델을 불러오고 있습니다... (시간이 걸릴 수 있습니다)",
                "elapsed_seconds": int(elapsed),
                "estimated_remaining_seconds": None,
                "device": None  # Will be updated after generator init
            }
        )
        
        try:
            generator = SkyReelsGenerator(
            model_type=params["model_type"],
            model_size=params.get("model_size", "14B"),
            resolution=params["resolution"],
            model_cache_dir=settings.SKYREELS_MODEL_CACHE,
        )
        except Exception as e:
            logger.error(f"Error initializing generator: {e}", exc_info=True)
            video.status = "failed"
            video.error_message = f"모델 초기화 실패: {str(e)}"
            video.updated_at = datetime.utcnow()
            db.commit()
            raise

        # Update progress after model loading (10%)
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        # Estimate remaining time: if 10% took X seconds, 90% remaining should take ~9X seconds
        estimated_remaining = (elapsed / 10) * 90 if elapsed > 0 else None
        
        # Get device information from generator
        device_info = generator.device if hasattr(generator, 'device') else None
        
        video.progress = 10
        video.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"[Progress] Job {job_id}: 10% - Model loaded")
        self.update_state(
            state="PROCESSING",
            meta={
                "progress": 10,
                "status": "모델 로딩 완료",
                "status_detail": "비디오 생성 준비 중...",
                "elapsed_seconds": int(elapsed),
                "estimated_remaining_seconds": int(estimated_remaining) if estimated_remaining else None,
                "device": device_info
            }
        )

        # Handle image for I2V mode
        image_path = None
        if params.get("model_type") == "i2v" and params.get("image_url"):
            # In a real implementation, download the image from URL
            # For now, we'll assume the image_url is a local path or skip this
            image_path = params.get("image_url")

        # Generate video
        logger.info("Starting video generation...")
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        # Estimate remaining: if 20% took X seconds, 80% remaining should take ~4X seconds
        estimated_remaining = (elapsed / 20) * 80 if elapsed > 0 else None
        
        video.progress = 20
        logger.info(f"[Progress] Job {job_id}: 20% - Starting generation")
        video.updated_at = datetime.utcnow()
        db.commit()
        self.update_state(
            state="PROCESSING",
            meta={
                "progress": 20,
                "status": "비디오 프레임 생성 중",
                "status_detail": f"{params.get('num_frames', 97)}개 프레임을 생성하고 있습니다...",
                "elapsed_seconds": int(elapsed),
                "estimated_remaining_seconds": int(estimated_remaining) if estimated_remaining else None,
                "device": device_info
            }
        )
        
        # 30% 진행률 업데이트 - 비디오 생성 시작
        db.refresh(video)
        video.progress = 30
        video.updated_at = datetime.utcnow()
        db.commit()
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        estimated_remaining = (elapsed / 30) * 70 if video.progress > 0 else None
        self.update_state(
            state="PROCESSING",
            meta={
                "progress": 30,
                "status": "비디오 프레임 생성 중",
                "status_detail": "비디오 생성을 시작합니다...",
                "elapsed_seconds": int(elapsed),
                "estimated_remaining_seconds": int(estimated_remaining) if estimated_remaining else None,
                "device": device_info
            }
        )
        logger.info(f"[Progress] Job {job_id}: 30% - Video generation started")

        # Generate video (this is the longest step)
        try:
            # 40% 진행률 업데이트 - 비디오 생성 중
            db.refresh(video)
            video.progress = 40
            video.updated_at = datetime.utcnow()
            db.commit()
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            estimated_remaining = (elapsed / 40) * 60 if video.progress > 0 else None
            self.update_state(
                state="PROCESSING",
                meta={
                    "progress": 40,
                    "status": "비디오 프레임 생성 중",
                    "status_detail": "비디오 프레임을 생성하고 있습니다...",
                    "elapsed_seconds": int(elapsed),
                    "estimated_remaining_seconds": int(estimated_remaining) if estimated_remaining else None,
                    "device": device_info
                }
        )
            logger.info(f"[Progress] Job {job_id}: 40% - Generating frames")
            
            # 50% 진행률 업데이트 - 중간 진행
            db.refresh(video)
            video.progress = 50
            video.updated_at = datetime.utcnow()
            db.commit()
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            estimated_remaining = (elapsed / 50) * 50 if video.progress > 0 else None
            self.update_state(
                state="PROCESSING",
                meta={
                    "progress": 50,
                    "status": "비디오 프레임 생성 중",
                    "status_detail": "비디오 프레임 생성 중...",
                    "elapsed_seconds": int(elapsed),
                    "estimated_remaining_seconds": int(estimated_remaining) if estimated_remaining else None,
                    "device": device_info
                }
            )
            logger.info(f"[Progress] Job {job_id}: 50% - Generating frames (halfway)")
            
            # 60% 진행률 업데이트 - 거의 완료
            db.refresh(video)
            video.progress = 60
            video.updated_at = datetime.utcnow()
            db.commit()
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            estimated_remaining = (elapsed / 60) * 40 if video.progress > 0 else None
            self.update_state(
                state="PROCESSING",
                meta={
                    "progress": 60,
                    "status": "비디오 프레임 생성 중",
                    "status_detail": "비디오 프레임 생성 거의 완료...",
                    "elapsed_seconds": int(elapsed),
                    "estimated_remaining_seconds": int(estimated_remaining) if estimated_remaining else None,
                    "device": device_info
                }
            )
            logger.info(f"[Progress] Job {job_id}: 60% - Generating frames (almost done)")
            logger.info(f"[Progress] Job {job_id}: 비디오 생성 시작 (generator.generate 호출)")

            # 비디오 생성 실행 (이 단계가 가장 오래 걸림)
            try:
                video_path = generator.generate(
                    prompt=params["prompt"],
                    num_frames=params.get("num_frames", 97),
                    guidance_scale=params.get("guidance_scale", 6.0),
                    num_inference_steps=params.get("num_inference_steps", 30),
                    image_path=image_path,
                    output_dir=str(temp_dir),
                )
                logger.info(f"[Progress] Job {job_id}: 비디오 생성 완료 - {video_path}")
            except Exception as gen_error:
                logger.error(f"[Progress] Job {job_id}: 비디오 생성 중 오류 발생: {gen_error}", exc_info=True)
                raise
        except Exception as e:
            logger.error(f"Error generating video: {e}", exc_info=True)
            video.status = "failed"
            video.error_message = f"비디오 생성 실패: {str(e)}"
            video.updated_at = datetime.utcnow()
            db.commit()
            raise

        # Update progress
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        # Estimate remaining: if 70% took X seconds, 30% remaining should take ~0.43X seconds
        estimated_remaining = (elapsed / 70) * 30 if elapsed > 0 else None
        
        video.progress = 70
        logger.info(f"[Progress] Job {job_id}: 70% - Video generated")
        video.updated_at = datetime.utcnow()
        db.commit()
        self.update_state(
            state="PROCESSING",
            meta={
                "progress": 70,
                "status": "비디오 생성 완료",
                "status_detail": "썸네일을 생성하고 있습니다...",
                "elapsed_seconds": int(elapsed),
                "estimated_remaining_seconds": int(estimated_remaining) if estimated_remaining else None,
                "device": device_info
            }
        )

        # Generate thumbnail
        thumbnail_path = generator.generate_thumbnail(video_path)

        # Update progress
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        # Estimate remaining: if 80% took X seconds, 20% remaining should take ~0.25X seconds
        estimated_remaining = (elapsed / 80) * 20 if elapsed > 0 else None
        
        video.progress = 80
        logger.info(f"[Progress] Job {job_id}: 80% - Creating thumbnail")
        video.updated_at = datetime.utcnow()
        db.commit()
        self.update_state(
            state="PROCESSING",
            meta={
                "progress": 80,
                "status": "썸네일 생성 완료",
                "status_detail": "파일을 업로드하고 있습니다...",
                "elapsed_seconds": int(elapsed),
                "estimated_remaining_seconds": int(estimated_remaining) if estimated_remaining else None,
                "device": device_info
            }
        )

        # Upload to storage
        video_url = storage.save_video(video_path, job_id)
        thumbnail_url = storage.save_thumbnail(thumbnail_path, job_id)

        # Update database
        video.status = "completed"
        video.progress = 100
        logger.info(f"[Progress] Job {job_id}: 100% - Completed")
        video.updated_at = datetime.utcnow()
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
            # Try to get a fresh database session in case the current one is broken
            try:
                if db:
                    db.rollback()
            except:
                pass
            
            # Create a new session for error update
            error_db = SessionLocal()
            try:
                video = error_db.query(Video).filter(Video.id == job_id).first()
                if video:
                    # Extract meaningful error message
                    error_msg = str(e)
                    if "OperationalError" in error_msg or "connection" in error_msg.lower():
                        error_msg = "데이터베이스 연결 오류가 발생했습니다. 서버를 확인해주세요."
                    elif "role" in error_msg.lower() and "does not exist" in error_msg.lower():
                        error_msg = "데이터베이스 사용자 설정 오류가 발생했습니다. .env 파일의 DATABASE_URL을 확인해주세요."
                    
                    video.status = "failed"
                    video.error_message = error_msg
                    video.updated_at = datetime.utcnow()
                    error_db.commit()
                    logger.info(f"Updated video {job_id} status to failed with error message")
            finally:
                error_db.close()
        except Exception as db_error:
            logger.error(f"Error updating database with failure: {db_error}", exc_info=True)

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
