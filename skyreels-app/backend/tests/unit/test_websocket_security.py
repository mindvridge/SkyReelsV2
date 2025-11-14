"""
Unit tests for WebSocket security
"""

import pytest
from unittest.mock import Mock, AsyncMock
from fastapi import WebSocket

from app.api.websocket_security import WebSocketSecurity


@pytest.fixture
def security_manager():
    """Create a security manager for testing"""
    return WebSocketSecurity(
        allowed_origins=["http://localhost:3000"],
        max_connections_per_ip=3,
        max_connections_per_job=5,
        rate_limit_window=60,
        rate_limit_max_attempts=10,
    )


@pytest.fixture
def mock_websocket():
    """Create a mock WebSocket"""
    ws = Mock(spec=WebSocket)
    ws.client = Mock()
    ws.client.host = "192.168.1.1"
    ws.headers = {"origin": "http://localhost:3000"}
    return ws


@pytest.mark.asyncio
async def test_validate_connection_success(security_manager, mock_websocket):
    """Test successful connection validation"""
    is_valid, error, ip = await security_manager.validate_connection(
        mock_websocket, "job-123", check_origin=True
    )

    assert is_valid is True
    assert error is None
    assert ip == "192.168.1.1"


@pytest.mark.asyncio
async def test_validate_connection_origin_blocked(security_manager, mock_websocket):
    """Test connection blocked by origin validation"""
    mock_websocket.headers = {"origin": "http://malicious-site.com"}

    is_valid, error, ip = await security_manager.validate_connection(
        mock_websocket, "job-123", check_origin=True
    )

    assert is_valid is False
    assert "Origin not allowed" in error
    assert ip == "192.168.1.1"


@pytest.mark.asyncio
async def test_validate_connection_rate_limit(security_manager, mock_websocket):
    """Test rate limiting"""
    # Make 10 connection attempts (limit)
    for i in range(10):
        is_valid, error, ip = await security_manager.validate_connection(
            mock_websocket, f"job-{i}", check_origin=False
        )
        assert is_valid is True

    # 11th attempt should be rate limited
    is_valid, error, ip = await security_manager.validate_connection(
        mock_websocket, "job-11", check_origin=False
    )

    assert is_valid is False
    assert "Rate limit exceeded" in error


@pytest.mark.asyncio
async def test_validate_connection_ip_limit(security_manager, mock_websocket):
    """Test per-IP connection limit"""
    # Register 3 connections (limit)
    for i in range(3):
        is_valid, error, ip = await security_manager.validate_connection(
            mock_websocket, f"job-{i}", check_origin=False
        )
        assert is_valid is True
        security_manager.register_connection(ip, f"job-{i}")

    # 4th connection should be blocked
    is_valid, error, ip = await security_manager.validate_connection(
        mock_websocket, "job-4", check_origin=False
    )

    assert is_valid is False
    assert "Too many concurrent connections from your IP" in error


@pytest.mark.asyncio
async def test_validate_connection_job_limit(security_manager, mock_websocket):
    """Test per-job connection limit"""
    job_id = "job-123"

    # Register 5 connections to same job (limit)
    for i in range(5):
        # Use different IPs
        mock_websocket.client.host = f"192.168.1.{i}"
        is_valid, error, ip = await security_manager.validate_connection(
            mock_websocket, job_id, check_origin=False
        )
        assert is_valid is True
        security_manager.register_connection(ip, job_id)

    # 6th connection should be blocked
    mock_websocket.client.host = "192.168.1.10"
    is_valid, error, ip = await security_manager.validate_connection(
        mock_websocket, job_id, check_origin=False
    )

    assert is_valid is False
    assert "Too many concurrent connections for this job" in error


def test_register_unregister_connection(security_manager):
    """Test connection registration and unregistration"""
    ip = "192.168.1.1"
    job_id = "job-123"

    # Register
    security_manager.register_connection(ip, job_id)

    stats = security_manager.get_stats()
    assert stats["connections_per_ip"][ip] == 1
    assert stats["connections_per_job"][job_id] == 1

    # Unregister
    security_manager.unregister_connection(ip, job_id)

    stats = security_manager.get_stats()
    assert ip not in stats["connections_per_ip"]
    assert job_id not in stats["connections_per_job"]


def test_get_stats(security_manager):
    """Test getting security statistics"""
    # Register some connections
    security_manager.register_connection("192.168.1.1", "job-1")
    security_manager.register_connection("192.168.1.1", "job-2")
    security_manager.register_connection("192.168.1.2", "job-1")

    stats = security_manager.get_stats()

    assert stats["total_ips_connected"] == 2
    assert stats["total_jobs_connected"] == 2
    assert stats["connections_per_ip"]["192.168.1.1"] == 2
    assert stats["connections_per_ip"]["192.168.1.2"] == 1
    assert stats["connections_per_job"]["job-1"] == 2
    assert stats["connections_per_job"]["job-2"] == 1
