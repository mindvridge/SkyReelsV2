"""
WebSocket routes for real-time updates
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from typing import Dict, List
import asyncio
import json
import logging
from sqlalchemy.orm import Session
from app.models.database import get_db, Video
from app.api.websocket_security import security_manager
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

# Connection manager to track active WebSocket connections
class ConnectionManager:
    def __init__(self):
        # Map of job_id -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, job_id: str):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()

        if job_id not in self.active_connections:
            self.active_connections[job_id] = []

        self.active_connections[job_id].append(websocket)
        logger.info(f"[WebSocket] Client connected to job {job_id}. Total connections: {len(self.active_connections[job_id])}")

    def disconnect(self, websocket: WebSocket, job_id: str):
        """Remove a WebSocket connection"""
        if job_id in self.active_connections:
            if websocket in self.active_connections[job_id]:
                self.active_connections[job_id].remove(websocket)
                logger.info(f"[WebSocket] Client disconnected from job {job_id}. Remaining: {len(self.active_connections[job_id])}")

            # Clean up empty lists
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific WebSocket"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"[WebSocket] Failed to send message: {e}")

    async def broadcast(self, job_id: str, message: dict):
        """Broadcast a message to all connections for a specific job"""
        if job_id not in self.active_connections:
            return

        dead_connections = []

        for connection in self.active_connections[job_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"[WebSocket] Failed to broadcast to connection: {e}")
                dead_connections.append(connection)

        # Clean up dead connections
        for dead in dead_connections:
            self.disconnect(dead, job_id)

    def get_connection_count(self, job_id: str) -> int:
        """Get number of active connections for a job"""
        return len(self.active_connections.get(job_id, []))


# Global connection manager instance
manager = ConnectionManager()


@router.websocket("/ws/progress/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time video generation progress updates

    Security Features:
    - Origin validation
    - Rate limiting per IP
    - Connection limits per IP and job
    - Automatic cleanup on disconnect

    Args:
        websocket: WebSocket connection
        job_id: Video generation job ID

    Message Format:
        {
            "type": "progress",
            "video": {
                "id": "uuid",
                "status": "processing",
                "progress": 45,
                ...
            }
        }
    """
    # Validate connection against security policies
    is_valid, error_message, client_ip = await security_manager.validate_connection(
        websocket, job_id, check_origin=settings.WS_CHECK_ORIGIN
    )

    if not is_valid:
        logger.warning(f"[WebSocket Security] Connection rejected for {client_ip}: {error_message}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=error_message)
        return

    # Register connection with security manager
    security_manager.register_connection(client_ip, job_id)

    # Accept WebSocket connection
    await manager.connect(websocket, job_id)

    try:
        # Get database session
        db = next(get_db())

        # Send initial status immediately
        video = db.query(Video).filter(Video.id == job_id).first()

        if video:
            await manager.send_personal_message({
                "type": "progress",
                "video": {
                    "id": video.id,
                    "status": video.status,
                    "progress": video.progress or 0,
                    "prompt": video.prompt,
                    "model_type": video.model_type,
                    "model_size": video.model_size,
                    "resolution": video.resolution,
                    "num_frames": video.num_frames,
                    "guidance_scale": video.guidance_scale,
                    "num_inference_steps": video.num_inference_steps,
                    "created_at": video.created_at.isoformat() if video.created_at else None,
                    "updated_at": video.updated_at.isoformat() if video.updated_at else None,
                    "video_url": video.video_url,
                    "error_message": video.error_message,
                    "image_url": video.image_url,
                }
            }, websocket)
        else:
            # Job not found
            await manager.send_personal_message({
                "type": "error",
                "message": f"Job {job_id} not found"
            }, websocket)
            await websocket.close()
            return

        # Keep connection alive and monitor for updates
        last_status = video.status
        last_progress = video.progress or 0

        while True:
            # Check for updates every 500ms
            await asyncio.sleep(0.5)

            # Refresh video from database
            db.refresh(video)

            # Check if status or progress changed
            if video.status != last_status or (video.progress or 0) != last_progress:
                last_status = video.status
                last_progress = video.progress or 0

                # Send update
                await manager.send_personal_message({
                    "type": "progress",
                    "video": {
                        "id": video.id,
                        "status": video.status,
                        "progress": video.progress or 0,
                        "prompt": video.prompt,
                        "model_type": video.model_type,
                        "model_size": video.model_size,
                        "resolution": video.resolution,
                        "num_frames": video.num_frames,
                        "guidance_scale": video.guidance_scale,
                        "num_inference_steps": video.num_inference_steps,
                        "created_at": video.created_at.isoformat() if video.created_at else None,
                        "updated_at": video.updated_at.isoformat() if video.updated_at else None,
                        "video_url": video.video_url,
                        "error_message": video.error_message,
                        "image_url": video.image_url,
                    }
                }, websocket)

            # Close connection if job is completed or failed
            if video.status in ["completed", "failed"]:
                logger.info(f"[WebSocket] Job {job_id} finished with status: {video.status}")
                await asyncio.sleep(1)  # Give client time to receive final message
                break

    except WebSocketDisconnect:
        logger.info(f"[WebSocket] Client disconnected from job {job_id}")
    except Exception as e:
        logger.error(f"[WebSocket] Error in progress endpoint: {e}")
    finally:
        # Cleanup connections
        manager.disconnect(websocket, job_id)
        security_manager.unregister_connection(client_ip, job_id)
        db.close()


async def broadcast_progress_update(job_id: str, video_data: dict):
    """
    Broadcast progress update to all connected clients for a specific job

    This function should be called from Celery workers when progress changes

    Args:
        job_id: Video generation job ID
        video_data: Dictionary containing video data
    """
    message = {
        "type": "progress",
        "video": video_data
    }

    await manager.broadcast(job_id, message)
    logger.info(f"[WebSocket] Broadcasted progress update to {manager.get_connection_count(job_id)} clients for job {job_id}")


@router.get("/ws/stats")
async def websocket_stats():
    """
    Get WebSocket security and connection statistics

    Returns:
        dict: Statistics including connection counts, rate limits, etc.
    """
    security_stats = security_manager.get_stats()
    connection_stats = {
        "active_jobs": len(manager.active_connections),
        "total_active_connections": sum(len(conns) for conns in manager.active_connections.values()),
        "connections_by_job": {
            job_id: len(conns) for job_id, conns in manager.active_connections.items()
        }
    }

    return {
        "security": security_stats,
        "connections": connection_stats,
        "limits": {
            "max_connections_per_ip": settings.WS_MAX_CONNECTIONS_PER_IP,
            "max_connections_per_job": settings.WS_MAX_CONNECTIONS_PER_JOB,
            "rate_limit_window": settings.WS_RATE_LIMIT_WINDOW,
            "rate_limit_max_attempts": settings.WS_RATE_LIMIT_MAX_ATTEMPTS,
        }
    }
