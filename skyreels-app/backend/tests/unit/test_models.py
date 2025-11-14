"""
Unit tests for database models and schemas
"""

import pytest
from datetime import datetime
from pydantic import ValidationError

from app.models.schemas import (
    VideoCreate,
    VideoResponse,
    VideoStatus,
    ModelType,
    ModelSize,
    Resolution,
)
from app.models.database import Video


def test_video_create_schema_valid():
    """Test VideoCreate schema with valid data"""
    data = {
        "prompt": "A cat playing piano",
        "model_type": "t2v",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 97,
        "guidance_scale": 6.0,
        "num_inference_steps": 30,
    }

    video = VideoCreate(**data)

    assert video.prompt == "A cat playing piano"
    assert video.model_type == ModelType.T2V
    assert video.model_size == ModelSize.SIZE_6B
    assert video.resolution == Resolution.RES_540P


def test_video_create_schema_invalid_frames():
    """Test VideoCreate with invalid frame count"""
    data = {
        "prompt": "Test",
        "model_type": "t2v",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 50,  # Too low (min 97)
        "guidance_scale": 6.0,
        "num_inference_steps": 30,
    }

    with pytest.raises(ValidationError) as exc_info:
        VideoCreate(**data)

    assert "num_frames" in str(exc_info.value)


def test_video_create_schema_invalid_guidance():
    """Test VideoCreate with invalid guidance scale"""
    data = {
        "prompt": "Test",
        "model_type": "t2v",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 97,
        "guidance_scale": 25.0,  # Too high (max 20)
        "num_inference_steps": 30,
    }

    with pytest.raises(ValidationError) as exc_info:
        VideoCreate(**data)

    assert "guidance_scale" in str(exc_info.value)


def test_video_create_i2v_with_image():
    """Test I2V creation with image URL"""
    data = {
        "prompt": "Test",
        "model_type": "i2v",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 97,
        "guidance_scale": 6.0,
        "num_inference_steps": 30,
        "image_url": "https://example.com/image.jpg",
    }

    video = VideoCreate(**data)

    assert video.model_type == ModelType.I2V
    assert str(video.image_url) == "https://example.com/image.jpg"


def test_video_model_creation():
    """Test Video database model creation"""
    video = Video(
        prompt="Test video",
        model_type="t2v",
        model_size="6B",
        resolution="540P",
        num_frames=97,
        guidance_scale=6.0,
        num_inference_steps=30,
        status="queued",
        progress=0,
    )

    assert video.prompt == "Test video"
    assert video.status == "queued"
    assert video.progress == 0
    assert video.created_at is not None


def test_video_model_defaults():
    """Test Video model default values"""
    video = Video(
        prompt="Test",
        model_type="t2v",
        model_size="6B",
        resolution="540P",
        num_frames=97,
        guidance_scale=6.0,
        num_inference_steps=30,
    )

    # Should have defaults
    assert video.status == "queued"
    assert video.progress == 0
    assert video.video_url is None
    assert video.thumbnail_url is None
    assert video.error_message is None


def test_video_status_enum():
    """Test VideoStatus enum values"""
    assert VideoStatus.QUEUED.value == "queued"
    assert VideoStatus.PROCESSING.value == "processing"
    assert VideoStatus.COMPLETED.value == "completed"
    assert VideoStatus.FAILED.value == "failed"


def test_model_type_enum():
    """Test ModelType enum values"""
    assert ModelType.T2V.value == "t2v"
    assert ModelType.I2V.value == "i2v"
    assert ModelType.DF.value == "df"


def test_model_size_enum():
    """Test ModelSize enum values"""
    assert ModelSize.SIZE_6B.value == "6B"
    assert ModelSize.SIZE_14B.value == "14B"
    assert ModelSize.SIZE_27B.value == "27B"


def test_resolution_enum():
    """Test Resolution enum values"""
    assert Resolution.RES_540P.value == "540P"
    assert Resolution.RES_720P.value == "720P"
