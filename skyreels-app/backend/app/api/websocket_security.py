"""
WebSocket security and rate limiting
"""

import time
import logging
from typing import Dict, Optional
from fastapi import WebSocket, HTTPException, status
from collections import defaultdict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class WebSocketSecurity:
    """
    Security manager for WebSocket connections

    Features:
    - Origin validation
    - Rate limiting per IP
    - Connection limits per job
    - Connection tracking and cleanup
    """

    def __init__(
        self,
        allowed_origins: list[str] = None,
        max_connections_per_ip: int = 5,
        max_connections_per_job: int = 10,
        rate_limit_window: int = 60,  # seconds
        rate_limit_max_attempts: int = 20,
    ):
        self.allowed_origins = allowed_origins or ["*"]
        self.max_connections_per_ip = max_connections_per_ip
        self.max_connections_per_job = max_connections_per_job
        self.rate_limit_window = rate_limit_window
        self.rate_limit_max_attempts = rate_limit_max_attempts

        # Track connections per IP
        self.connections_per_ip: Dict[str, int] = defaultdict(int)

        # Track connection attempts for rate limiting
        self.connection_attempts: Dict[str, list[float]] = defaultdict(list)

        # Track total connections per job
        self.connections_per_job: Dict[str, int] = defaultdict(int)

    def _get_client_ip(self, websocket: WebSocket) -> str:
        """Extract client IP from WebSocket connection"""
        # Try to get real IP from headers (for proxy/load balancer)
        forwarded = websocket.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()

        # Fallback to direct client
        if websocket.client:
            return websocket.client.host

        return "unknown"

    def _get_origin(self, websocket: WebSocket) -> Optional[str]:
        """Extract origin from WebSocket headers"""
        return websocket.headers.get("origin")

    def _check_origin(self, websocket: WebSocket) -> bool:
        """Validate WebSocket origin against allowed origins"""
        if "*" in self.allowed_origins:
            return True

        origin = self._get_origin(websocket)
        if not origin:
            logger.warning("[WebSocket Security] No origin header provided")
            return False

        # Check if origin matches any allowed origin
        for allowed in self.allowed_origins:
            if origin == allowed or origin.startswith(allowed):
                return True

        logger.warning(f"[WebSocket Security] Origin not allowed: {origin}")
        return False

    def _check_rate_limit(self, client_ip: str) -> bool:
        """Check if client IP has exceeded rate limit"""
        now = time.time()

        # Clean up old attempts outside the window
        self.connection_attempts[client_ip] = [
            timestamp for timestamp in self.connection_attempts[client_ip]
            if now - timestamp < self.rate_limit_window
        ]

        # Check if exceeded rate limit
        if len(self.connection_attempts[client_ip]) >= self.rate_limit_max_attempts:
            logger.warning(
                f"[WebSocket Security] Rate limit exceeded for IP: {client_ip} "
                f"({len(self.connection_attempts[client_ip])} attempts in {self.rate_limit_window}s)"
            )
            return False

        # Record this attempt
        self.connection_attempts[client_ip].append(now)
        return True

    def _check_ip_connection_limit(self, client_ip: str) -> bool:
        """Check if client IP has too many concurrent connections"""
        if self.connections_per_ip[client_ip] >= self.max_connections_per_ip:
            logger.warning(
                f"[WebSocket Security] Connection limit exceeded for IP: {client_ip} "
                f"({self.connections_per_ip[client_ip]} connections)"
            )
            return False
        return True

    def _check_job_connection_limit(self, job_id: str) -> bool:
        """Check if job has too many concurrent connections"""
        if self.connections_per_job[job_id] >= self.max_connections_per_job:
            logger.warning(
                f"[WebSocket Security] Connection limit exceeded for job: {job_id} "
                f"({self.connections_per_job[job_id]} connections)"
            )
            return False
        return True

    async def validate_connection(
        self,
        websocket: WebSocket,
        job_id: str,
        check_origin: bool = True,
    ) -> tuple[bool, Optional[str], str]:
        """
        Validate WebSocket connection against security policies

        Args:
            websocket: WebSocket connection to validate
            job_id: Job ID being accessed
            check_origin: Whether to validate origin (can be disabled for testing)

        Returns:
            Tuple of (is_valid, error_message, client_ip)
        """
        client_ip = self._get_client_ip(websocket)

        # 1. Check origin
        if check_origin and not self._check_origin(websocket):
            return False, "Origin not allowed", client_ip

        # 2. Check rate limit
        if not self._check_rate_limit(client_ip):
            return False, "Rate limit exceeded. Please try again later.", client_ip

        # 3. Check IP connection limit
        if not self._check_ip_connection_limit(client_ip):
            return False, "Too many concurrent connections from your IP", client_ip

        # 4. Check job connection limit
        if not self._check_job_connection_limit(job_id):
            return False, "Too many concurrent connections for this job", client_ip

        return True, None, client_ip

    def register_connection(self, client_ip: str, job_id: str):
        """Register a new connection"""
        self.connections_per_ip[client_ip] += 1
        self.connections_per_job[job_id] += 1
        logger.info(
            f"[WebSocket Security] Connection registered - "
            f"IP: {client_ip} ({self.connections_per_ip[client_ip]} total), "
            f"Job: {job_id} ({self.connections_per_job[job_id]} total)"
        )

    def unregister_connection(self, client_ip: str, job_id: str):
        """Unregister a connection"""
        if client_ip in self.connections_per_ip:
            self.connections_per_ip[client_ip] = max(0, self.connections_per_ip[client_ip] - 1)

            # Clean up empty entries
            if self.connections_per_ip[client_ip] == 0:
                del self.connections_per_ip[client_ip]

        if job_id in self.connections_per_job:
            self.connections_per_job[job_id] = max(0, self.connections_per_job[job_id] - 1)

            # Clean up empty entries
            if self.connections_per_job[job_id] == 0:
                del self.connections_per_job[job_id]

        logger.info(
            f"[WebSocket Security] Connection unregistered - "
            f"IP: {client_ip}, Job: {job_id}"
        )

    def get_stats(self) -> dict:
        """Get current security statistics"""
        return {
            "total_ips_connected": len(self.connections_per_ip),
            "total_jobs_connected": len(self.connections_per_job),
            "connections_per_ip": dict(self.connections_per_ip),
            "connections_per_job": dict(self.connections_per_job),
            "rate_limited_ips": len([
                ip for ip, attempts in self.connection_attempts.items()
                if len(attempts) >= self.rate_limit_max_attempts
            ]),
        }


# Global security manager instance
security_manager = WebSocketSecurity(
    allowed_origins=["*"],  # Will be configured from settings
    max_connections_per_ip=5,
    max_connections_per_job=10,
    rate_limit_window=60,
    rate_limit_max_attempts=20,
)


def configure_security(
    allowed_origins: list[str],
    max_connections_per_ip: int = 5,
    max_connections_per_job: int = 10,
):
    """Configure global security manager"""
    global security_manager
    security_manager = WebSocketSecurity(
        allowed_origins=allowed_origins,
        max_connections_per_ip=max_connections_per_ip,
        max_connections_per_job=max_connections_per_job,
    )
    logger.info(f"[WebSocket Security] Configured with origins: {allowed_origins}")
