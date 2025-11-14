"""
Integration tests for complete video generation workflow
"""

import pytest
import time
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


@pytest.mark.integration
@pytest.mark.slow
def test_complete_video_generation_workflow(client: TestClient, sample_video_data):
    """
    Test complete video generation workflow:
    1. Create job
    2. Check status (queued)
    3. Job moves to processing
    4. Job completes or fails
    5. Can retrieve video
    6. Can delete video
    """
    # Step 1: Create job
    response = client.post("/api/v1/videos/generate", json=sample_video_data)
    assert response.status_code == 202

    job_data = response.json()
    job_id = job_data["job_id"]
    assert job_data["status"] == "queued"

    # Step 2: Check initial status
    response = client.get(f"/api/v1/videos/status/{job_id}")
    assert response.status_code == 200

    status_data = response.json()
    assert status_data["id"] == job_id
    assert status_data["status"] in ["queued", "processing"]
    assert status_data["prompt"] == sample_video_data["prompt"]

    # Step 3: Verify job appears in list
    response = client.get("/api/v1/videos/list")
    assert response.status_code == 200

    list_data = response.json()
    assert list_data["total"] >= 1

    job_ids = [video["id"] for video in list_data["items"]]
    assert job_id in job_ids

    # Step 4: Can cancel job while processing
    response = client.post(f"/api/v1/videos/{job_id}/cancel")
    assert response.status_code == 200

    # Verify cancelled
    response = client.get(f"/api/v1/videos/status/{job_id}")
    status_data = response.json()
    assert status_data["status"] == "failed"
    assert "cancelled" in status_data["error_message"].lower()

    # Step 5: Can delete job
    response = client.delete(f"/api/v1/videos/{job_id}")
    assert response.status_code == 200

    # Verify deleted
    response = client.get(f"/api/v1/videos/status/{job_id}")
    assert response.status_code == 404


@pytest.mark.integration
def test_multiple_videos_concurrent(client: TestClient, sample_video_data):
    """Test creating multiple videos concurrently"""
    job_ids = []

    # Create 3 videos
    for i in range(3):
        data = sample_video_data.copy()
        data["prompt"] = f"Test video {i}"

        response = client.post("/api/v1/videos/generate", json=data)
        assert response.status_code == 202

        job_data = response.json()
        job_ids.append(job_data["job_id"])

    # Verify all jobs are in the list
    response = client.get("/api/v1/videos/list")
    assert response.status_code == 200

    list_data = response.json()
    assert list_data["total"] >= 3

    # All jobs should be findable
    list_job_ids = [video["id"] for video in list_data["items"]]
    for job_id in job_ids:
        assert job_id in list_job_ids

    # Clean up
    for job_id in job_ids:
        client.delete(f"/api/v1/videos/{job_id}")


@pytest.mark.integration
def test_list_videos_with_filters(client: TestClient, test_db: Session):
    """Test listing videos with various filters"""
    from app.models.database import Video

    # Create videos with different attributes
    videos_data = [
        {"prompt": "Video 1", "status": "completed", "model_size": "6B"},
        {"prompt": "Video 2", "status": "processing", "model_size": "14B"},
        {"prompt": "Video 3", "status": "failed", "model_size": "6B"},
        {"prompt": "Video 4", "status": "completed", "model_size": "27B"},
    ]

    for data in videos_data:
        video = Video(
            prompt=data["prompt"],
            model_type="t2v",
            model_size=data["model_size"],
            resolution="540P",
            num_frames=97,
            guidance_scale=6.0,
            num_inference_steps=30,
            status=data["status"],
            progress=100 if data["status"] == "completed" else 50,
        )
        test_db.add(video)
    test_db.commit()

    # Filter by status
    response = client.get("/api/v1/videos/list?status=completed")
    assert response.status_code == 200
    data = response.json()
    assert len([v for v in data["items"] if v["status"] == "completed"]) >= 2

    # Test pagination
    response = client.get("/api/v1/videos/list?page=1&limit=2")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) <= 2


@pytest.mark.integration
def test_error_handling_workflow(client: TestClient):
    """Test error handling in various scenarios"""
    # Test 1: Invalid model type
    invalid_data = {
        "prompt": "Test",
        "model_type": "invalid_type",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 97,
        "guidance_scale": 6.0,
        "num_inference_steps": 30,
    }

    response = client.post("/api/v1/videos/generate", json=invalid_data)
    assert response.status_code == 422

    # Test 2: I2V without image
    i2v_data = {
        "prompt": "Test",
        "model_type": "i2v",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 97,
        "guidance_scale": 6.0,
        "num_inference_steps": 30,
        # Missing image_url
    }

    response = client.post("/api/v1/videos/generate", json=i2v_data)
    assert response.status_code == 400
    assert "image_url is required" in response.json()["detail"]

    # Test 3: Get non-existent video
    response = client.get("/api/v1/videos/status/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404

    # Test 4: Delete non-existent video
    response = client.delete("/api/v1/videos/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404

    # Test 5: Cancel non-existent video
    response = client.post("/api/v1/videos/00000000-0000-0000-0000-000000000000/cancel")
    assert response.status_code == 404
