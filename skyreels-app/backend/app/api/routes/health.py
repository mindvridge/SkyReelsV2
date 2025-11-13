"""Health check endpoints"""

from datetime import datetime
from fastapi import APIRouter, Depends
from app.models.schemas import HealthResponse
from app.config import get_settings, Settings

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(settings: Settings = Depends(get_settings)):
    """
    Health check endpoint

    Returns application status and version
    """
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        timestamp=datetime.utcnow(),
    )


@router.get("/ready")
async def readiness_check():
    """
    Readiness check endpoint for Kubernetes/Docker

    Returns 200 if service is ready to accept requests
    """
    return {"status": "ready"}
