# WebSocket Security Documentation

## Overview

The SkyReels V2 application implements comprehensive WebSocket security to protect real-time video generation progress updates. This document describes the security features, configuration, and best practices.

## Security Features

### 1. Origin Validation

WebSocket connections are validated against a whitelist of allowed origins to prevent cross-site WebSocket hijacking (CSWSH) attacks.

**How it works:**
- Checks the `Origin` header from incoming WebSocket connections
- Compares against configured allowed origins
- Rejects connections from unauthorized origins

**Configuration:**
```python
# In .env or environment variables
CORS_ORIGINS=["http://localhost:3000", "http://localhost:80", "https://yourdomain.com"]
WS_CHECK_ORIGIN=true  # Set to false to disable (development only)
```

### 2. Rate Limiting

Prevents abuse by limiting the number of connection attempts from a single IP address within a time window.

**Default Limits:**
- **Window**: 60 seconds
- **Max Attempts**: 20 connections per window
- **Behavior**: Connections exceeding the limit are rejected with a rate limit error

**Configuration:**
```python
WS_RATE_LIMIT_WINDOW=60          # seconds
WS_RATE_LIMIT_MAX_ATTEMPTS=20    # max connection attempts per window
```

**How it works:**
- Tracks connection attempts per IP address with timestamps
- Automatically cleans up expired attempts outside the time window
- Uses exponential backoff strategy

### 3. Connection Limits

Prevents resource exhaustion by limiting concurrent connections.

**Two Types of Limits:**

#### A. Per-IP Connection Limit
Limits the number of concurrent WebSocket connections from a single IP address.

**Default**: 5 connections per IP

**Configuration:**
```python
WS_MAX_CONNECTIONS_PER_IP=5
```

#### B. Per-Job Connection Limit
Limits the number of concurrent connections monitoring a single video generation job.

**Default**: 10 connections per job

**Configuration:**
```python
WS_MAX_CONNECTIONS_PER_JOB=10
```

### 4. Automatic Connection Tracking

The security system automatically tracks and cleans up connections.

**Features:**
- Tracks active connections by IP and job ID
- Automatically decrements counts when connections close
- Cleans up empty entries to prevent memory leaks
- Provides real-time statistics via `/ws/stats` endpoint

## Environment Variables

Add these to your `.env` file or environment:

```bash
# WebSocket Security Settings
WS_MAX_CONNECTIONS_PER_IP=5           # Max concurrent connections per IP
WS_MAX_CONNECTIONS_PER_JOB=10         # Max concurrent connections per job
WS_RATE_LIMIT_WINDOW=60               # Rate limit time window (seconds)
WS_RATE_LIMIT_MAX_ATTEMPTS=20         # Max connection attempts per window
WS_CHECK_ORIGIN=true                  # Enable origin validation

# CORS Origins (also used for WebSocket origin validation)
CORS_ORIGINS=["http://localhost:3000", "http://localhost:80"]
```

## WebSocket Endpoints

### Connection Endpoint

**URL**: `ws://<host>/ws/progress/{job_id}`

**Security Checks** (in order):
1. Origin validation (if enabled)
2. Rate limit check
3. Per-IP connection limit
4. Per-job connection limit

**Rejection Responses:**

| Error | Code | Reason |
|-------|------|--------|
| Origin not allowed | 1008 | CORS/Origin validation failed |
| Rate limit exceeded | 1008 | Too many connection attempts |
| Too many connections from IP | 1008 | Exceeded per-IP limit |
| Too many connections for job | 1008 | Exceeded per-job limit |

### Statistics Endpoint

**URL**: `GET /ws/stats`

**Response:**
```json
{
  "security": {
    "total_ips_connected": 3,
    "total_jobs_connected": 5,
    "connections_per_ip": {
      "192.168.1.1": 2,
      "192.168.1.2": 1
    },
    "connections_per_job": {
      "job-uuid-1": 3,
      "job-uuid-2": 2
    },
    "rate_limited_ips": 1
  },
  "connections": {
    "active_jobs": 5,
    "total_active_connections": 8,
    "connections_by_job": {
      "job-uuid-1": 3,
      "job-uuid-2": 2,
      "job-uuid-3": 1,
      "job-uuid-4": 1,
      "job-uuid-5": 1
    }
  },
  "limits": {
    "max_connections_per_ip": 5,
    "max_connections_per_job": 10,
    "rate_limit_window": 60,
    "rate_limit_max_attempts": 20
  }
}
```

## Implementation Details

### Backend Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     WebSocket Client                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│          WebSocket Endpoint (/ws/progress/{id})         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              WebSocketSecurity Manager                   │
│  ┌────────────────────────────────────────────────┐    │
│  │  1. Origin Validation                           │    │
│  │  2. Rate Limit Check                            │    │
│  │  3. Per-IP Connection Limit                     │    │
│  │  4. Per-Job Connection Limit                    │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────┘
                      │
                   Accept/Reject
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Connection Manager                          │
│  - Tracks active connections                            │
│  - Manages broadcasting                                 │
│  - Handles cleanup                                      │
└─────────────────────────────────────────────────────────┘
```

### Security Manager Class

Located in: `backend/app/api/websocket_security.py`

**Key Methods:**

```python
class WebSocketSecurity:
    async def validate_connection(
        websocket: WebSocket,
        job_id: str,
        check_origin: bool = True
    ) -> tuple[bool, Optional[str], str]:
        """Validate connection against all security policies"""

    def register_connection(client_ip: str, job_id: str):
        """Register a new connection"""

    def unregister_connection(client_ip: str, job_id: str):
        """Unregister a closed connection"""

    def get_stats() -> dict:
        """Get current security statistics"""
```

## Client IP Detection

The security system detects client IP addresses using:

1. **X-Forwarded-For header** (for proxies/load balancers)
2. **Direct client host** (fallback)

**Example with Nginx proxy:**
```nginx
location /ws/ {
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
}
```

## Testing

### Test Origin Validation

```bash
# Should succeed (allowed origin)
wscat -c "ws://localhost:8000/ws/progress/job-123" \
  --origin "http://localhost:3000"

# Should fail (disallowed origin)
wscat -c "ws://localhost:8000/ws/progress/job-123" \
  --origin "http://malicious-site.com"
```

### Test Rate Limiting

```bash
# Script to test rate limiting
for i in {1..25}; do
  echo "Attempt $i"
  wscat -c "ws://localhost:8000/ws/progress/job-123" \
    --origin "http://localhost:3000" &
  sleep 0.1
done

# After 20 connections, should see rate limit errors
```

### Test Connection Limits

```python
# Python script to test connection limits
import asyncio
import websockets

async def connect(job_id, num):
    uri = f"ws://localhost:8000/ws/progress/{job_id}"
    try:
        async with websockets.connect(uri) as ws:
            print(f"Connection {num} established")
            await asyncio.sleep(30)  # Keep alive
    except Exception as e:
        print(f"Connection {num} failed: {e}")

async def test_limits():
    # Test per-job limit (default 10)
    tasks = [connect("job-123", i) for i in range(15)]
    await asyncio.gather(*tasks)

asyncio.run(test_limits())
# Should see some connections rejected after limit reached
```

### Check Statistics

```bash
# View current security stats
curl http://localhost:8000/ws/stats | jq
```

## Production Recommendations

### 1. Enable Origin Validation

Always enable origin validation in production:

```bash
WS_CHECK_ORIGIN=true
CORS_ORIGINS=["https://yourdomain.com", "https://app.yourdomain.com"]
```

### 2. Adjust Limits Based on Load

Monitor your application and adjust limits:

```bash
# For high-traffic applications
WS_MAX_CONNECTIONS_PER_IP=10
WS_MAX_CONNECTIONS_PER_JOB=20
WS_RATE_LIMIT_MAX_ATTEMPTS=30

# For low-traffic/development
WS_MAX_CONNECTIONS_PER_IP=3
WS_MAX_CONNECTIONS_PER_JOB=5
WS_RATE_LIMIT_MAX_ATTEMPTS=10
```

### 3. Use HTTPS/WSS

Always use secure WebSocket connections (WSS) in production:

```javascript
// Frontend
const wsUrl = `wss://${window.location.host}/ws/progress/${jobId}`;
```

### 4. Monitor Security Events

Monitor logs for security-related warnings:

```bash
# Watch for security rejections
docker-compose logs -f backend | grep "WebSocket Security"
```

### 5. Add DDoS Protection

Consider additional layers:
- **Cloudflare** or **AWS WAF** for DDoS protection
- **Rate limiting at reverse proxy** (Nginx, HAProxy)
- **IP blacklisting** for repeat offenders

### 6. Implement Authentication (Optional)

For user-specific applications, add JWT token validation:

```python
# Example JWT validation (not implemented in current version)
async def validate_connection(websocket: WebSocket, job_id: str):
    # Get token from query params or headers
    token = websocket.query_params.get("token")

    # Validate JWT token
    user = verify_jwt_token(token)

    # Check if user has access to this job
    if not has_access(user, job_id):
        return False, "Unauthorized"

    return True, None
```

## Troubleshooting

### Connection Rejected: Origin Not Allowed

**Problem**: WebSocket connection fails with "Origin not allowed" error

**Solutions:**
1. Add your origin to `CORS_ORIGINS` in `.env`
2. Temporarily disable origin check for development: `WS_CHECK_ORIGIN=false`
3. Check browser origin matches exactly (including protocol and port)

### Connection Rejected: Rate Limit Exceeded

**Problem**: Getting rate limit errors

**Solutions:**
1. Wait for rate limit window to expire (default 60 seconds)
2. Increase `WS_RATE_LIMIT_MAX_ATTEMPTS`
3. Increase `WS_RATE_LIMIT_WINDOW`
4. Check if you're reconnecting too frequently

### Connection Rejected: Too Many Connections

**Problem**: Cannot establish more connections

**Solutions:**
1. Close existing connections before opening new ones
2. Increase connection limits in configuration
3. Check for connection leaks (connections not properly closed)
4. View `/ws/stats` to see current connection counts

## Security Best Practices

1. **Always validate origins in production**
2. **Use WSS (secure WebSocket) over HTTPS**
3. **Implement rate limiting appropriate for your use case**
4. **Monitor connection statistics regularly**
5. **Log and alert on security events**
6. **Keep connection limits reasonable to prevent resource exhaustion**
7. **Consider implementing authentication for sensitive data**
8. **Use reverse proxy (Nginx, HAProxy) for additional security**
9. **Regularly update dependencies for security patches**
10. **Test security features before deploying to production**

## Related Documentation

- [WEBSOCKET_API.md](./WEBSOCKET_API.md) - WebSocket API usage and integration
- [README.md](./README.md) - General application documentation
- [.env.example](./.env.example) - Environment configuration examples
