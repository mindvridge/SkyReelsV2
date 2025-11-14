"""
Unit tests for health check API
"""

import pytest
from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    """Test health check endpoint"""
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "version" in data


def test_api_root(client: TestClient):
    """Test API root endpoint"""
    response = client.get("/api/v1")

    assert response.status_code == 200
    data = response.json()

    assert "name" in data
    assert "version" in data
    assert "endpoints" in data

    # Check important endpoints are listed
    endpoints = data["endpoints"]
    assert "health" in endpoints
    assert "generate" in endpoints
    assert "websocket" in endpoints


def test_root_redirect(client: TestClient):
    """Test root path redirects to docs"""
    response = client.get("/", follow_redirects=False)

    # Should redirect to /docs
    assert response.status_code in [307, 308]  # Temporary or Permanent Redirect
    assert response.headers["location"] == "/docs"
