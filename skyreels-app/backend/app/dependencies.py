"""FastAPI dependencies"""

from sqlalchemy.orm import Session
from app.models.database import get_db
from app.config import get_settings, Settings

__all__ = ["get_db", "get_settings"]
