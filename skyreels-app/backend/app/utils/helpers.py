"""Helper utility functions"""

import hashlib
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def generate_file_hash(file_path: str) -> str:
    """
    Generate SHA256 hash of a file

    Args:
        file_path: Path to file

    Returns:
        Hex digest of file hash
    """
    sha256_hash = hashlib.sha256()

    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)

    return sha256_hash.hexdigest()


def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """
    Truncate text to maximum length

    Args:
        text: Input text
        max_length: Maximum length
        suffix: Suffix to add if truncated

    Returns:
        Truncated text
    """
    if len(text) <= max_length:
        return text

    return text[: max_length - len(suffix)] + suffix


def validate_file_extension(filename: str, allowed_extensions: list[str]) -> bool:
    """
    Validate file extension

    Args:
        filename: Filename to validate
        allowed_extensions: List of allowed extensions (e.g., ['.jpg', '.png'])

    Returns:
        True if extension is allowed
    """
    extension = filename.lower().split(".")[-1]
    return f".{extension}" in [ext.lower() for ext in allowed_extensions]
