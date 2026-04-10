import logging
import asyncio
import aiohttp
import ssl
import io
from typing import Optional, List
from dataclasses import dataclass
from extract_favicon.main_async import get_best_favicon

# Constants
BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36"
DEFAULT_TIMEOUT = 10


@dataclass
class FaviconResult:
    image_url: Optional[str] = None
    canonical_link: Optional[str] = None
    image_content: Optional[bytes] = None
    image_format: Optional[str] = None


logger = logging.getLogger(__name__)


async def extract_favicon_and_canonical_url(
    feed_link: str,
    timeout: int = DEFAULT_TIMEOUT,
) -> FaviconResult:
    """Extract favicon URL and canonical URL from feed link using extract_favicon.

    Args:
        feed_link: Feed's website link
        timeout: HTTP request timeout in seconds

    Returns:
        FaviconResult object with optional image_url, canonical_link, image_content, and image_format
    """
    if not feed_link:
        return FaviconResult()

    try:
        # get_best_favicon handles the connection, redirects, and strategies (Content -> DuckDuckGo -> Google)
        favicon = await get_best_favicon(url=feed_link)

        result = FaviconResult()

        if favicon:
            # Check for redirection / canonical URL
            if favicon.http and favicon.http.final_url:
                if favicon.http.final_url != feed_link:
                    result.canonical_link = favicon.http.final_url

            # If get_best_favicon returns a result, use it
            if favicon.url:
                result.image_url = favicon.url

            result.image_format = favicon.format

            # Handle image content
            if favicon.image:
                if isinstance(favicon.image, bytes):
                    result.image_content = favicon.image
                else:
                    # It's a PIL Image
                    try:
                        buf = io.BytesIO()
                        fmt = favicon.format
                        favicon.image.save(buf, format=fmt)
                        result.image_content = buf.getvalue()
                    except Exception as e:
                        logger.warning(f"Failed to convert PIL image to bytes: {e}")

        return result

    except Exception as e:
        logger.warning(f"Favicon extraction failed for {feed_link}: {e}")
        return FaviconResult()
