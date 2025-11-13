"""API middleware for CORS, error handling, and logging"""

import time
import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging requests and responses"""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Log request
        logger.info(f"Request: {request.method} {request.url.path}")

        try:
            response = await call_next(request)

            # Log response
            process_time = time.time() - start_time
            logger.info(
                f"Response: {request.method} {request.url.path} "
                f"Status: {response.status_code} Time: {process_time:.3f}s"
            )

            # Add processing time header
            response.headers["X-Process-Time"] = str(process_time)

            return response

        except Exception as e:
            logger.error(f"Request failed: {e}", exc_info=True)
            raise


def add_cors_middleware(app, origins: list[str]):
    """
    Add CORS middleware to FastAPI app

    Args:
        app: FastAPI application
        origins: List of allowed origins
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


async def validation_exception_handler(request: Request, exc: Exception):
    """Handle validation errors"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": str(exc),
            "type": "validation_error",
        },
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "type": "server_error",
        },
    )
