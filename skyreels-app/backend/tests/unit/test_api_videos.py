"""
Unit tests for video generation API
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from uuid import uuid4

from app.models.database import Video


def test_generate_video_t2v(client: TestClient, sample_video_data):
    """Test T2V video generation endpoint"""
    response = client.post("/api/v1/videos/generate", json=sample_video_data)

    assert response.status_code == 202  # Accepted
    data = response.json()

    assert "job_id" in data
    assert data["status"] == "queued"
    assert "created_at" in data


def test_generate_video_i2v(client: TestClient, sample_i2v_data):
    """Test I2V video generation endpoint"""
    response = client.post("/api/v1/videos/generate", json=sample_i2v_data)

    assert response.status_code == 202
    data = response.json()

    assert "job_id" in data
    assert data["status"] == "queued"


def test_generate_video_i2v_without_image(client: TestClient, sample_i2v_data):
    """Test I2V without image URL should fail"""
    data = sample_i2v_data.copy()
    del data["image_url"]

    response = client.post("/api/v1/videos/generate", json=data)

    assert response.status_code == 400
    assert "image_url is required" in response.json()["detail"]


def test_generate_video_invalid_data(client: TestClient):
    """Test video generation with invalid data"""
    invalid_data = {
        "prompt": "",  # Empty prompt
        "model_type": "invalid",
        "model_size": "999B",
    }

    response = client.post("/api/v1/videos/generate", json=invalid_data)

    assert response.status_code == 422  # Unprocessable Entity


def test_get_video_status(client: TestClient, test_db: Session, sample_video_data):
    """Test getting video status"""
    # Create a video in DB
    video = Video(
        prompt=sample_video_data["prompt"],
        model_type=sample_video_data["model_type"],
        model_size=sample_video_data["model_size"],
        resolution=sample_video_data["resolution"],
        num_frames=sample_video_data["num_frames"],
        guidance_scale=sample_video_data["guidance_scale"],
        num_inference_steps=sample_video_data["num_inference_steps"],
        status="processing",
        progress=50,
    )
    test_db.add(video)
    test_db.commit()
    test_db.refresh(video)

    # Get status
    response = client.get(f"/api/v1/videos/status/{video.id}")

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == str(video.id)
    assert data["status"] == "processing"
    assert data["progress"] == 50
    assert data["prompt"] == sample_video_data["prompt"]


def test_get_video_status_not_found(client: TestClient):
    """Test getting status of non-existent video"""
    fake_id = str(uuid4())
    response = client.get(f"/api/v1/videos/status/{fake_id}")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_list_videos_empty(client: TestClient):
    """Test listing videos when none exist"""
    response = client.get("/api/v1/videos/list")

    assert response.status_code == 200
    data = response.json()

    assert data["items"] == []
    assert data["total"] == 0
    assert data["page"] == 1


def test_list_videos(client: TestClient, test_db: Session):
    """Test listing videos"""
    # Create some videos
    for i in range(5):
        video = Video(
            prompt=f"Test video {i}",
            model_type="t2v",
            model_size="6B",
            resolution="540P",
            num_frames=97,
            guidance_scale=6.0,
            num_inference_steps=30,
            status="completed",
            progress=100,
        )
        test_db.add(video)
    test_db.commit()

    # List videos
    response = client.get("/api/v1/videos/list")

    assert response.status_code == 200
    data = response.json()

    assert len(data["items"]) == 5
    assert data["total"] == 5
    assert data["page"] == 1


def test_list_videos_pagination(client: TestClient, test_db: Session):
    """Test video list pagination"""
    # Create 15 videos
    for i in range(15):
        video = Video(
            prompt=f"Test video {i}",
            model_type="t2v",
            model_size="6B",
            resolution="540P",
            num_frames=97,
            guidance_scale=6.0,
            num_inference_steps=30,
            status="completed",
            progress=100,
        )
        test_db.add(video)
    test_db.commit()

    # Get page 1 (limit 10)
    response = client.get("/api/v1/videos/list?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 10
    assert data["total"] == 15
    assert data["page"] == 1

    # Get page 2
    response = client.get("/api/v1/videos/list?page=2&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 5
    assert data["page"] == 2


def test_list_videos_filter_by_status(client: TestClient, test_db: Session):
    """Test filtering videos by status"""
    # Create videos with different statuses
    statuses = ["completed", "processing", "failed", "completed", "queued"]
    for status in statuses:
        video = Video(
            prompt="Test video",
            model_type="t2v",
            model_size="6B",
            resolution="540P",
            num_frames=97,
            guidance_scale=6.0,
            num_inference_steps=30,
            status=status,
            progress=100 if status == "completed" else 50,
        )
        test_db.add(video)
    test_db.commit()

    # Filter by completed
    response = client.get("/api/v1/videos/list?status=completed")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert all(item["status"] == "completed" for item in data["items"])


def test_delete_video(client: TestClient, test_db: Session):
    """Test deleting a video"""
    # Create a video
    video = Video(
        prompt="Test video",
        model_type="t2v",
        model_size="6B",
        resolution="540P",
        num_frames=97,
        guidance_scale=6.0,
        num_inference_steps=30,
        status="completed",
        progress=100,
    )
    test_db.add(video)
    test_db.commit()
    test_db.refresh(video)

    # Delete video
    response = client.delete(f"/api/v1/videos/{video.id}")

    assert response.status_code == 200
    assert "deleted successfully" in response.json()["message"]

    # Verify deleted
    response = client.get(f"/api/v1/videos/status/{video.id}")
    assert response.status_code == 404


def test_delete_video_not_found(client: TestClient):
    """Test deleting non-existent video"""
    fake_id = str(uuid4())
    response = client.delete(f"/api/v1/videos/{fake_id}")

    assert response.status_code == 404


def test_cancel_video(client: TestClient, test_db: Session):
    """Test canceling a video generation"""
    # Create a processing video
    video = Video(
        prompt="Test video",
        model_type="t2v",
        model_size="6B",
        resolution="540P",
        num_frames=97,
        guidance_scale=6.0,
        num_inference_steps=30,
        status="processing",
        progress=30,
    )
    test_db.add(video)
    test_db.commit()
    test_db.refresh(video)

    # Cancel video
    response = client.post(f"/api/v1/videos/{video.id}/cancel")

    assert response.status_code == 200
    assert "cancelled" in response.json()["message"].lower()

    # Verify status changed
    test_db.refresh(video)
    assert video.status == "failed"
    assert "cancelled" in video.error_message.lower()
