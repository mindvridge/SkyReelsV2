"""FastAPI main application"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.models.database import init_db
from app.api.routes import videos, health, upload, websocket
from app.api.middleware import (
    add_cors_middleware,
    LoggingMiddleware,
    validation_exception_handler,
    general_exception_handler,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events

    Runs on startup and shutdown
    """
    # Startup
    logger.info("Starting SkyReels V2 Video Generator API")
    logger.info(f"Version: {settings.APP_VERSION}")
    logger.info(f"Storage: {settings.STORAGE_TYPE}")

    # Initialize database
    try:
        init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    yield

    # Shutdown
    logger.info("Shutting down application")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SkyReels V2 Video Generation API - Text-to-Video, Image-to-Video, and Diffusion Forcing",
    lifespan=lifespan,
)

# Add middleware
add_cors_middleware(app, settings.CORS_ORIGINS)
app.add_middleware(LoggingMiddleware)

# Add exception handlers
app.add_exception_handler(Exception, general_exception_handler)

# Include routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(videos.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")
app.include_router(websocket.router, tags=["websocket"])  # WebSocket doesn't need /api/v1 prefix

# Serve static files (for local storage)
try:
    import os

    if os.path.exists(settings.LOCAL_STORAGE_PATH):
        app.mount(
            "/storage",
            StaticFiles(directory=settings.LOCAL_STORAGE_PATH),
            name="storage",
        )
        logger.info(f"Mounted storage at: {settings.LOCAL_STORAGE_PATH}")
except Exception as e:
    logger.warning(f"Could not mount storage directory: {e}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/v1")
async def api_root():
    """API root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "endpoints": {
            "health": "/api/v1/health",
            "generate": "/api/v1/videos/generate",
            "status": "/api/v1/videos/status/{job_id}",
            "list": "/api/v1/videos/list",
            "delete": "/api/v1/videos/{job_id}",
            "websocket": "ws://<host>/ws/progress/{job_id}",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
