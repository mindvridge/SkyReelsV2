"""File upload endpoints"""

import os
import uuid
import logging
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from PIL import Image
import io

from app.config import get_settings, Settings

router = APIRouter(prefix="/upload", tags=["upload"])
logger = logging.getLogger(__name__)

# Allowed image formats
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
):
    """
    Upload an image for I2V mode

    Args:
        file: Image file (JPG, PNG, WebP, GIF)

    Returns:
        Image URL for use in I2V generation
    """
    try:
        # Validate file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # Read file content
        content = await file.read()

        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )

        # Validate image
        try:
            image = Image.open(io.BytesIO(content))
            image.verify()  # Verify it's a valid image

            # Re-open for processing (verify() closes the file)
            image = Image.open(io.BytesIO(content))

            # Convert to RGB if necessary
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")

            # Get image dimensions
            width, height = image.size
            logger.info(f"Image uploaded: {width}x{height}, format: {image.format}")

        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image file: {str(e)}"
            )

        # Generate unique filename
        file_id = str(uuid.uuid4())
        filename = f"{file_id}{file_ext}"

        # Save to storage
        upload_dir = Path(settings.LOCAL_STORAGE_PATH) / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)

        file_path = upload_dir / filename

        # Save image
        with open(file_path, "wb") as f:
            f.write(content)

        # Generate URL
        image_url = f"/storage/uploads/{filename}"

        logger.info(f"Image uploaded successfully: {image_url}")

        return {
            "image_url": image_url,
            "filename": filename,
            "size": len(content),
            "dimensions": {
                "width": width,
                "height": height
            },
            "format": image.format
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload image: {str(e)}"
        )


@router.delete("/image/{filename}")
async def delete_image(
    filename: str,
    settings: Settings = Depends(get_settings),
):
    """
    Delete an uploaded image

    Args:
        filename: Image filename to delete

    Returns:
        Success message
    """
    try:
        # Validate filename (security)
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(
                status_code=400,
                detail="Invalid filename"
            )

        file_path = Path(settings.LOCAL_STORAGE_PATH) / "uploads" / filename

        if not file_path.exists():
            raise HTTPException(
                status_code=404,
                detail="Image not found"
            )

        # Delete file
        file_path.unlink()

        logger.info(f"Image deleted: {filename}")

        return {
            "message": "Image deleted successfully",
            "filename": filename
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting image: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete image: {str(e)}"
        )
