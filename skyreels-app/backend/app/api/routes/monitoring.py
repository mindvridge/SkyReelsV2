"""
Monitoring and metrics API endpoints
"""

from fastapi import APIRouter, Query
from typing import Optional

from app.services.monitoring import get_metrics_collector

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/health")
async def health_check():
    """
    Detailed health check with system metrics
    """
    collector = get_metrics_collector()
    system_metrics = collector.get_system_metrics()
    summary = collector.get_summary()

    return {
        "status": "healthy",
        "uptime_hours": summary["uptime_hours"],
        "system": system_metrics,
    }


@router.get("/metrics")
async def get_metrics(minutes: int = Query(default=60, ge=1, le=1440)):
    """
    Get comprehensive metrics

    Args:
        minutes: Time window in minutes (default: 60, max: 1440/24h)
    """
    collector = get_metrics_collector()

    return {
        "summary": collector.get_summary(),
        "system": collector.get_system_metrics(),
        "api": collector.get_api_metrics(last_n_minutes=minutes),
        "videos": collector.get_video_metrics(last_n_minutes=minutes),
    }


@router.get("/metrics/api")
async def get_api_metrics(minutes: int = Query(default=60, ge=1, le=1440)):
    """Get API metrics only"""
    collector = get_metrics_collector()
    return collector.get_api_metrics(last_n_minutes=minutes)


@router.get("/metrics/videos")
async def get_video_metrics(minutes: int = Query(default=60, ge=1, le=1440)):
    """Get video generation metrics only"""
    collector = get_metrics_collector()
    return collector.get_video_metrics(last_n_minutes=minutes)


@router.get("/metrics/system")
async def get_system_metrics():
    """Get system metrics only"""
    collector = get_metrics_collector()
    return collector.get_system_metrics()


@router.get("/summary")
async def get_summary():
    """Get overall summary"""
    collector = get_metrics_collector()
    return collector.get_summary()
