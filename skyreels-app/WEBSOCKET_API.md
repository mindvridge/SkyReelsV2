# WebSocket API Documentation

## Overview
The SkyReels V2 application supports real-time video generation progress updates via WebSocket connections. This provides instant feedback to users without the need for polling.

## WebSocket Endpoint

### Progress Updates
```
ws://localhost:8000/ws/progress/{job_id}
```

**Parameters:**
- `job_id` (string): The unique identifier for the video generation job

**Connection Flow:**
1. Client connects to the WebSocket endpoint with a specific job ID
2. Server sends progress updates as they occur
3. Connection closes when video generation completes or fails

## Message Format

### Progress Update Message
```json
{
  "type": "progress",
  "video": {
    "id": "uuid",
    "status": "processing",
    "progress": 45,
    "prompt": "A cinematic video...",
    "model_type": "t2v",
    "model_size": "14B",
    "resolution": "720P",
    "num_frames": 97,
    "guidance_scale": 7.0,
    "num_inference_steps": 30,
    "created_at": "2025-11-13T12:00:00Z",
    "updated_at": "2025-11-13T12:01:30Z",
    "video_url": null,
    "error_message": null
  }
}
```

### Completion Message
```json
{
  "type": "progress",
  "video": {
    "id": "uuid",
    "status": "completed",
    "progress": 100,
    "video_url": "/storage/videos/uuid.mp4",
    ...
  }
}
```

### Error Message
```json
{
  "type": "progress",
  "video": {
    "id": "uuid",
    "status": "failed",
    "progress": 0,
    "error_message": "CUDA out of memory",
    ...
  }
}
```

## Backend Implementation (To Be Implemented)

### FastAPI WebSocket Route
```python
# backend/app/api/routes/websocket.py

from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from typing import Dict
import asyncio
import json

router = APIRouter()

# Store active connections per job_id
active_connections: Dict[str, list[WebSocket]] = {}

@router.websocket("/ws/progress/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()

    # Add connection to active connections
    if job_id not in active_connections:
        active_connections[job_id] = []
    active_connections[job_id].append(websocket)

    try:
        # Keep connection alive and send updates
        while True:
            # Get latest video status from database
            video = await get_video_by_id(job_id)

            if video:
                # Send progress update
                await websocket.send_json({
                    "type": "progress",
                    "video": video.dict()
                })

                # Close connection if completed or failed
                if video.status in ["completed", "failed"]:
                    break

            # Wait before next update
            await asyncio.sleep(0.5)  # Update every 500ms

    except WebSocketDisconnect:
        # Remove connection when client disconnects
        if job_id in active_connections:
            active_connections[job_id].remove(websocket)
            if not active_connections[job_id]:
                del active_connections[job_id]

# Function to broadcast progress updates from Celery worker
async def broadcast_progress(job_id: str, video_data: dict):
    """Broadcast progress update to all connected clients for this job"""
    if job_id in active_connections:
        dead_connections = []

        for connection in active_connections[job_id]:
            try:
                await connection.send_json({
                    "type": "progress",
                    "video": video_data
                })
            except:
                dead_connections.append(connection)

        # Clean up dead connections
        for dead in dead_connections:
            active_connections[job_id].remove(dead)
```

### Celery Worker Integration
```python
# backend/app/services/video_generator.py

from app.api.routes.websocket import broadcast_progress
import asyncio

class SkyReelsGenerator:
    async def update_progress(self, job_id: str, progress: int):
        """Update progress in database and broadcast via WebSocket"""
        # Update database
        video = await update_video_progress(job_id, progress)

        # Broadcast to WebSocket clients
        await broadcast_progress(job_id, video.dict())

    def generate_video(self, job_id: str, ...):
        """Generate video with progress updates"""
        # Update progress at key stages
        asyncio.run(self.update_progress(job_id, 10))  # Loading model
        # ... model loading ...

        asyncio.run(self.update_progress(job_id, 30))  # Generating frames
        # ... generation ...

        asyncio.run(self.update_progress(job_id, 80))  # Encoding video
        # ... encoding ...

        asyncio.run(self.update_progress(job_id, 100))  # Complete
```

### Register WebSocket Routes
```python
# backend/app/main.py

from app.api.routes import videos, health, upload, websocket

app.include_router(websocket.router, tags=["websocket"])
```

## Frontend Implementation (Already Implemented)

### Custom Hook
- `useWebSocket`: Generic WebSocket hook with auto-reconnect
- `useVideoProgressWebSocket`: Specialized hook for video progress
- `useVideoStatus`: Updated to prefer WebSocket over polling

### Features
- ✅ Automatic reconnection (up to 10 attempts)
- ✅ Graceful fallback to polling if WebSocket fails
- ✅ Connection status indicator in UI
- ✅ Real-time progress updates (no 2-second delay)

### Environment Variables
```bash
# .env
VITE_WS_URL=ws://localhost:8000
VITE_API_URL=http://localhost:8000
```

## Testing

### Manual Testing
1. Start the backend server
2. Start the frontend
3. Generate a video
4. Observe "Live" indicator in ProgressTracker (green dot)
5. If WebSocket fails, it falls back to polling automatically

### WebSocket Testing Tools
- **Postman**: Supports WebSocket connections
- **wscat**: CLI tool for WebSocket testing
  ```bash
  npm install -g wscat
  wscat -c ws://localhost:8000/ws/progress/job-id-here
  ```

## Benefits
- ⚡ **Real-time updates**: No polling delay (2 seconds → instant)
- 🔄 **Automatic fallback**: Works even if WebSocket not supported
- 📉 **Reduced server load**: No constant HTTP requests
- 🎯 **Better UX**: Users see progress immediately
- 💚 **Connection indicator**: Users know when real-time updates are active

## Future Enhancements
- [ ] Implement backend WebSocket route
- [ ] Add Celery worker integration for progress broadcasting
- [ ] Add WebSocket connection pooling
- [ ] Add authentication for WebSocket connections
- [ ] Add heartbeat/ping-pong for connection health
- [ ] Support multiple simultaneous jobs per user
