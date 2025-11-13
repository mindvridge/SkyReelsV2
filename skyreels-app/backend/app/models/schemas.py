"""Pydantic schemas for request/response validation"""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, HttpUrl
from enum import Enum


class ModelType(str, Enum):
    """Video generation model types"""
    T2V = "t2v"  # Text-to-Video
    I2V = "i2v"  # Image-to-Video
    DF = "df"    # Diffusion Forcing (infinite length)


class ModelSize(str, Enum):
    """Model size options"""
    SIZE_1_3B = "1.3B"  # 1.3B parameters (~15GB VRAM)
    SIZE_14B = "14B"    # 14B parameters (~51GB VRAM)


class Resolution(str, Enum):
    """Video resolution options"""
    RES_540P = "540P"
    RES_720P = "720P"


class VideoStatus(str, Enum):
    """Video generation job status"""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoCreate(BaseModel):
    """Request schema for video generation"""
    prompt: str = Field(..., min_length=1, max_length=1000, description="Text prompt for video generation")
    model_type: ModelType = Field(default=ModelType.T2V, description="Model type to use")
    model_size: ModelSize = Field(default=ModelSize.SIZE_14B, description="Model size (1.3B or 14B)")
    resolution: Resolution = Field(default=Resolution.RES_540P, description="Video resolution")
    num_frames: int = Field(default=97, ge=97, le=193, description="Number of frames to generate")
    guidance_scale: float = Field(default=6.0, ge=1.0, le=20.0, description="Guidance scale for generation")
    num_inference_steps: int = Field(default=30, ge=10, le=100, description="Number of inference steps")
    image_url: Optional[HttpUrl] = Field(default=None, description="Image URL for I2V mode (required for I2V)")

    class Config:
        json_schema_extra = {
            "example": {
                "prompt": "A cat playing piano in a jazz club",
                "model_type": "t2v",
                "model_size": "14B",
                "resolution": "540P",
                "num_frames": 97,
                "guidance_scale": 6.0,
                "num_inference_steps": 30
            }
        }


class VideoResponse(BaseModel):
    """Response schema for video information"""
    id: str
    prompt: str
    model_type: str
    model_size: str
    resolution: str
    num_frames: int
    guidance_scale: float
    status: VideoStatus
    progress: int = Field(ge=0, le=100)
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VideoListResponse(BaseModel):
    """Response schema for video list"""
    videos: list[VideoResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class JobCreatedResponse(BaseModel):
    """Response schema for created job"""
    job_id: str
    status: VideoStatus
    created_at: datetime
    message: str = "Video generation job created successfully"


class MessageResponse(BaseModel):
    """Generic message response"""
    message: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    timestamp: datetime
