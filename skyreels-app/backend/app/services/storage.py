"""Storage service for video files"""

import os
import shutil
import logging
from pathlib import Path
from typing import Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class StorageService:
    """
    Service for storing video files locally or on S3
    """

    def __init__(self, storage_type: str = "local", local_path: str = "/app/storage", **kwargs):
        """
        Initialize storage service

        Args:
            storage_type: 'local' or 's3'
            local_path: Path for local storage
            **kwargs: Additional parameters for S3 (bucket, access_key, secret_key, region)
        """
        self.storage_type = storage_type
        self.local_path = Path(local_path)
        self.local_path.mkdir(parents=True, exist_ok=True)

        if storage_type == "s3":
            self._init_s3_client(**kwargs)

        logger.info(f"Storage service initialized: {storage_type}")

    def _init_s3_client(self, **kwargs):
        """Initialize S3 client"""
        try:
            import boto3

            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=kwargs.get("access_key_id"),
                aws_secret_access_key=kwargs.get("secret_access_key"),
                region_name=kwargs.get("region", "us-east-1"),
            )
            self.s3_bucket = kwargs.get("bucket")
            logger.info(f"S3 client initialized for bucket: {self.s3_bucket}")

        except Exception as e:
            logger.error(f"Error initializing S3 client: {e}")
            raise

    def save_video(self, source_path: str, job_id: UUID) -> str:
        """
        Save video file to storage

        Args:
            source_path: Path to source video file
            job_id: Job UUID

        Returns:
            URL or path to stored video
        """
        try:
            if self.storage_type == "local":
                return self._save_local(source_path, job_id, "video.mp4")
            else:
                return self._save_s3(source_path, job_id, "video.mp4")

        except Exception as e:
            logger.error(f"Error saving video: {e}")
            raise

    def save_thumbnail(self, source_path: str, job_id: UUID) -> str:
        """
        Save thumbnail image to storage

        Args:
            source_path: Path to source thumbnail file
            job_id: Job UUID

        Returns:
            URL or path to stored thumbnail
        """
        try:
            if self.storage_type == "local":
                return self._save_local(source_path, job_id, "thumbnail.jpg")
            else:
                return self._save_s3(source_path, job_id, "thumbnail.jpg")

        except Exception as e:
            logger.error(f"Error saving thumbnail: {e}")
            raise

    def _save_local(self, source_path: str, job_id: UUID, filename: str) -> str:
        """Save file to local storage"""
        job_dir = self.local_path / str(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)

        dest_path = job_dir / filename
        shutil.copy2(source_path, dest_path)

        # Return relative URL path
        relative_path = f"/storage/{job_id}/{filename}"
        logger.info(f"File saved locally: {relative_path}")
        return relative_path

    def _save_s3(self, source_path: str, job_id: UUID, filename: str) -> str:
        """Save file to S3"""
        try:
            s3_key = f"videos/{job_id}/{filename}"

            # Upload to S3
            self.s3_client.upload_file(
                source_path,
                self.s3_bucket,
                s3_key,
                ExtraArgs={"ContentType": "video/mp4" if filename.endswith(".mp4") else "image/jpeg"},
            )

            # Generate public URL
            url = f"https://{self.s3_bucket}.s3.amazonaws.com/{s3_key}"
            logger.info(f"File uploaded to S3: {url}")
            return url

        except Exception as e:
            logger.error(f"Error uploading to S3: {e}")
            raise

    def delete_files(self, job_id: UUID) -> bool:
        """
        Delete files associated with a job

        Args:
            job_id: Job UUID

        Returns:
            True if successful
        """
        try:
            if self.storage_type == "local":
                job_dir = self.local_path / str(job_id)
                if job_dir.exists():
                    shutil.rmtree(job_dir)
                    logger.info(f"Deleted local files for job: {job_id}")
            else:
                # Delete from S3
                prefix = f"videos/{job_id}/"
                response = self.s3_client.list_objects_v2(Bucket=self.s3_bucket, Prefix=prefix)

                if "Contents" in response:
                    objects = [{"Key": obj["Key"]} for obj in response["Contents"]]
                    self.s3_client.delete_objects(Bucket=self.s3_bucket, Delete={"Objects": objects})
                    logger.info(f"Deleted S3 files for job: {job_id}")

            return True

        except Exception as e:
            logger.error(f"Error deleting files: {e}")
            return False

    def get_storage_path(self, job_id: UUID) -> Path:
        """Get local storage path for a job (for temporary files)"""
        job_dir = self.local_path / "temp" / str(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)
        return job_dir
