import zstandard as zstd
import io
import os
import logging
from typing import Generator, TextIO

logger = logging.getLogger(__name__)


def get_reader(file_path: str) -> Generator[str, None, None]:
    """
    Yields lines from a file
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    logger.info(f"Opening {file_path} for reading...")

    with open(file_path, "r", encoding="utf-8") as fh:
        for line in fh:
            yield line


def get_writer(file_path: str) -> TextIO:
    """
    Returns a file-like object for writing
    """
    logger.info(f"Opening {file_path} for writing...")

    return open(file_path, "w", encoding="utf-8")
