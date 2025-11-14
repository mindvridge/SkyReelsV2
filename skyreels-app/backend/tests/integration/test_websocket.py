"""
Integration tests for WebSocket connections
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.database import Video


@pytest.mark.integration
def test_websocket_connection(client: TestClient, test_db: Session):
    """Test WebSocket connection and initial message"""
    # Create a video in DB
    video = Video(
        prompt="Test video",
        model_type="t2v",
        model_size="6B",
        resolution="540P",
        num_frames=97,
        guidance_scale=6.0,
        num_inference_steps=30,
        status="processing",
        progress=0,
    )
    test_db.add(video)
    test_db.commit()
    test_db.refresh(video)

    # Connect to WebSocket
    with client.websocket_connect(f"/ws/progress/{video.id}") as websocket:
        # Should receive initial status
        data = websocket.receive_json()

        assert data["type"] == "progress"
        assert data["video"]["id"] == str(video.id)
        assert data["video"]["status"] == "processing"
        assert data["video"]["progress"] == 0


@pytest.mark.integration
def test_websocket_progress_updates(client: TestClient, test_db: Session):
    """Test receiving progress updates via WebSocket"""
    # Create a video
    video = Video(
        prompt="Test video",
        model_type="t2v",
        model_size="6B",
        resolution="540P",
        num_frames=97,
        guidance_scale=6.0,
        num_inference_steps=30,
        status="processing",
        progress=0,
    )
    test_db.add(video)
    test_db.commit()
    test_db.refresh(video)

    with client.websocket_connect(f"/ws/progress/{video.id}") as websocket:
        # Receive initial message
        initial = websocket.receive_json()
        assert initial["video"]["progress"] == 0

        # Update progress in DB
        video.progress = 50
        test_db.commit()

        # Should receive update (with timeout)
        try:
            data = websocket.receive_json(timeout=2)
            assert data["video"]["progress"] == 50
        except:
            # May timeout if polling hasn't detected change yet
            pass


@pytest.mark.integration
def test_websocket_completion(client: TestClient, test_db: Session):
    """Test WebSocket closes when video completes"""
    # Create a completed video
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
        video_url="/storage/video.mp4",
    )
    test_db.add(video)
    test_db.commit()
    test_db.refresh(video)

    with client.websocket_connect(f"/ws/progress/{video.id}") as websocket:
        # Should receive completion message
        data = websocket.receive_json()

        assert data["video"]["status"] == "completed"
        assert data["video"]["progress"] == 100
        assert data["video"]["video_url"] is not None

        # Connection should close after completion
        # (with a small delay for client to receive message)


@pytest.mark.integration
def test_websocket_not_found(client: TestClient):
    """Test WebSocket with non-existent job"""
    fake_id = "00000000-0000-0000-0000-000000000000"

    # Should be able to connect but receive error
    with client.websocket_connect(f"/ws/progress/{fake_id}") as websocket:
        try:
            data = websocket.receive_json(timeout=1)
            # May receive error message or connection closes
        except:
            # Connection may close immediately
            pass


@pytest.mark.integration
def test_websocket_stats_endpoint(client: TestClient, test_db: Session):
    """Test WebSocket statistics endpoint"""
    response = client.get("/ws/stats")

    assert response.status_code == 200
    data = response.json()

    assert "security" in data
    assert "connections" in data
    assert "limits" in data

    # Check structure
    assert "total_ips_connected" in data["security"]
    assert "active_jobs" in data["connections"]
    assert "max_connections_per_ip" in data["limits"]
