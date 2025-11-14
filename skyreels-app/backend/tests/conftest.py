"""
Pytest configuration and fixtures
"""

import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.database import Base, get_db
from app.config import Settings


# Test database URL (in-memory SQLite)
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_db() -> Generator[Session, None, None]:
    """
    Create a fresh database for each test

    Uses in-memory SQLite for fast tests
    """
    # Create test engine with in-memory SQLite
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Create session
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db: Session) -> Generator[TestClient, None, None]:
    """
    Create a test client with test database
    """
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_settings() -> Settings:
    """
    Test settings
    """
    return Settings(
        APP_NAME="SkyReels V2 Test",
        DEBUG=True,
        DATABASE_URL=TEST_DATABASE_URL,
        REDIS_URL="redis://localhost:6379/1",  # Use different DB for tests
        STORAGE_TYPE="local",
        LOCAL_STORAGE_PATH="/tmp/skyreels-test-storage",
        WS_CHECK_ORIGIN=False,  # Disable origin check for tests
    )


@pytest.fixture
def sample_video_data():
    """
    Sample video generation request data
    """
    return {
        "prompt": "A cat playing piano in a jazz club",
        "model_type": "t2v",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 97,
        "guidance_scale": 6.0,
        "num_inference_steps": 30,
    }


@pytest.fixture
def sample_i2v_data():
    """
    Sample I2V video generation request data
    """
    return {
        "prompt": "A cat playing piano",
        "model_type": "i2v",
        "model_size": "6B",
        "resolution": "540P",
        "num_frames": 97,
        "guidance_scale": 6.0,
        "num_inference_steps": 30,
        "image_url": "https://example.com/cat.jpg",
    }
