"""SQLAlchemy database models"""

import uuid
from datetime import datetime
from typing import Generator
from sqlalchemy import create_engine, Column, String, Integer, Float, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.dialects.postgresql import UUID

from app.config import get_settings

settings = get_settings()

# Database engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


class Video(Base):
    """Video generation job model"""

    __tablename__ = "videos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt = Column(Text, nullable=False)
    model_type = Column(String(10), nullable=False)  # t2v, i2v, df
    model_size = Column(String(10), nullable=False, default="14B")  # 1.3B, 14B
    resolution = Column(String(10), nullable=False)  # 540P, 720P
    num_frames = Column(Integer, default=97)
    guidance_scale = Column(Float, default=6.0)
    num_inference_steps = Column(Integer, default=30)

    # Optional image URL for I2V
    image_url = Column(Text, nullable=True)

    # Job status
    status = Column(String(20), nullable=False, default="queued")  # queued, processing, completed, failed
    progress = Column(Integer, default=0)  # 0-100

    # Results
    video_url = Column(Text, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Video {self.id} ({self.status})>"


def get_db() -> Generator[Session, None, None]:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
