"""Application configuration settings"""

import os
from typing import Literal
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "SkyReels V2 Video Generator"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://skyreels:skyreels@postgres:5432/skyreels"

    # Redis & Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"

    # Storage
    STORAGE_TYPE: Literal["local", "s3"] = "local"
    LOCAL_STORAGE_PATH: str = "/app/storage"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "us-east-1"

    # SkyReels Model
    SKYREELS_MODEL_CACHE: str = "/models"
    DEFAULT_MODEL_T2V: str = "Skywork/SkyReels-V2-T2V-14B-540P"
    DEFAULT_MODEL_I2V: str = "Skywork/SkyReels-V2-I2V-14B-540P"
    DEFAULT_MODEL_DF: str = "Skywork/SkyReels-V2-DF-14B-540P"
    DEFAULT_RESOLUTION: Literal["540P", "720P"] = "540P"

    # Model Settings
    DEFAULT_NUM_FRAMES: int = 97
    DEFAULT_GUIDANCE_SCALE: float = 6.0
    DEFAULT_NUM_INFERENCE_STEPS: int = 30
    MAX_FRAMES: int = 193
    MIN_FRAMES: int = 97

    # API Settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:80"]

    # WebSocket Security
    WS_MAX_CONNECTIONS_PER_IP: int = 5
    WS_MAX_CONNECTIONS_PER_JOB: int = 10
    WS_RATE_LIMIT_WINDOW: int = 60  # seconds
    WS_RATE_LIMIT_MAX_ATTEMPTS: int = 20
    WS_CHECK_ORIGIN: bool = True  # Set to False for development

    # Pagination
    DEFAULT_PAGE_SIZE: int = 10
    MAX_PAGE_SIZE: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
