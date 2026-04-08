from functools import lru_cache
from typing import TypedDict, Optional, Dict, List
import logging
import asyncio
import aiohttp
import ssl

logger = logging.getLogger(__name__)

# Constants
BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36"
DEFAULT_RSS_TIMEOUT = 15
FEED_CONTENT_CACHE_PREFIX = "feed:content:"

# 30 minutes cache for feed content
FEED_CACHE_TTL = 1800
# 50MB limit for feed content
MAX_FEED_SIZE_BYTES = 50 * 1024 * 1024


class FetchResult(TypedDict):
    content: str
    headers: Dict[str, str]
    status_code: int
    not_modified: bool
    error: Optional[str]
    final_url: Optional[str]
    permanent_redirect: bool


def _build_error_result(status_code: int, error_msg: str) -> FetchResult:
    """Helper to construct uniform error responses."""
    return {
        "content": "",
        "headers": {},
        "status_code": status_code,
        "not_modified": False,
        "error": error_msg,
        "final_url": None,
        "permanent_redirect": False,
    }


def _is_feed_content_type(content_type: str) -> bool:
    """Check if content type indicates a feed."""
    ct = content_type.lower()
    return (
        "application/rss+xml" in ct
        or "application/atom+xml" in ct
        or "application/xml" in ct
        or "text/xml" in ct
        or "application/json" in ct
        or "application/feed+json" in ct
    )


async def fetch_feed_content(
    url: str,
    etag: Optional[str] = None,
    last_modified: Optional[str] = None,
    timeout: int = DEFAULT_RSS_TIMEOUT,
) -> FetchResult:
    """Fetch feed content with conditional headers using aiohttp."""

    # RSSHub Proxy Replacement
    if "https://rsshub.app" in url:
        url = url.replace("https://rsshub.app", "http://localhost:1200")

    headers = {
        "User-Agent": BROWSER_USER_AGENT,
    }
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    # SSL context that ignores errors
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    connector = aiohttp.TCPConnector(ssl=ssl_context, limit=0, ttl_dns_cache=300)

    timeout_config = aiohttp.ClientTimeout(total=timeout, connect=10, sock_read=timeout)

    async with aiohttp.ClientSession(
        connector=connector, timeout=timeout_config
    ) as session:
        try:
            async with session.get(
                url, headers=headers, allow_redirects=True
            ) as response:

                # Handle 304 Not Modified
                if response.status == 304:
                    return {
                        "content": "",
                        "headers": dict(response.headers),
                        "status_code": 304,
                        "not_modified": True,
                        "error": None,
                        "final_url": str(response.url),
                        "permanent_redirect": False,
                    }

                # Handle error statuses
                if response.status >= 400:
                    return _build_error_result(
                        response.status, f"HTTP {response.status}"
                    )

                # Check size limit via Content-Length if available
                try:
                    content_length = int(response.headers.get("Content-Length", 0))
                    if content_length > MAX_FEED_SIZE_BYTES:
                        return _build_error_result(
                            413, f"Feed content too large ({content_length} bytes)"
                        )
                except ValueError:
                    pass

                # Read content
                try:
                    # aiohttp reads entire body into memory
                    content_bytes = await response.read()

                    if len(content_bytes) > MAX_FEED_SIZE_BYTES:
                        return _build_error_result(
                            413, f"Feed content too large ({len(content_bytes)} bytes)"
                        )

                    # Try to decode
                    encoding = response.get_encoding()
                    try:
                        content = content_bytes.decode(encoding)
                    except Exception:
                        content = content_bytes.decode("utf-8", errors="replace")

                except aiohttp.ClientPayloadError as e:
                    return _build_error_result(502, f"Payload error: {e}")
                except Exception as e:
                    return _build_error_result(500, f"Content reading failed: {e}")

                # Basic validity check (unless it's JSON)
                content_type = response.headers.get("Content-Type", "").lower()
                is_json = "json" in content_type

                if not is_json and not content.strip():
                    return _build_error_result(204, "Empty content")

                # Detect permanent redirect in history
                # aiohttp history is a tuple of response objects
                permanent_redirect = False
                if response.history:
                    for r in response.history:
                        if r.status in (301, 308):
                            permanent_redirect = True
                            break

                return {
                    "content": content,
                    "headers": dict(response.headers),
                    "status_code": response.status,
                    "not_modified": False,
                    "error": None,
                    "final_url": str(response.url),
                    "permanent_redirect": permanent_redirect,
                }

        except (asyncio.TimeoutError, aiohttp.ClientError) as e:
            # Network errors
            status = 408 if isinstance(e, asyncio.TimeoutError) else 502
            return _build_error_result(
                status,
                f"Request error: {type(e).__name__} {e}",
            )

        except Exception as e:
            return _build_error_result(500, f"Unexpected error: {str(e)}")
