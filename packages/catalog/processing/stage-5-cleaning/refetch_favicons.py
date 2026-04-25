import asyncio
import json
import logging
import os
import sys
import io
import ssl
import hashlib
from pathlib import Path
import aiohttp
from PIL import Image
from tqdm import tqdm

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from feed.favicon import extract_favicon_and_canonical_url

# Setup logging
# Suppress noisy libraries
logging.getLogger("fake_useragent").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.ERROR)
logging.getLogger("aiohttp").setLevel(logging.ERROR)
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

FAVICONS_DIR = Path("../stage-3-favicon-dedupe/favicons/")
BROKEN_FILE = "broken_favicons.jsonl"
RESULT_FILE = "refetch_results.jsonl"
BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36"

# Ensure favicons dir exists
FAVICONS_DIR.mkdir(parents=True, exist_ok=True)


async def _download_content(url, log_context_url):
    if not url:
        return None, None
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    try:
        headers = {
            "User-Agent": BROWSER_USER_AGENT,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        if log_context_url:
            headers["Referer"] = log_context_url

        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(ssl=ssl_context),
            headers=headers,
        ) as session:
            async with session.get(url, timeout=10) as resp:
                if resp.status == 200:
                    content = await resp.read()
                    c_type = resp.headers.get("Content-Type")
                    return content, c_type
    except Exception:
        pass
    return None, None


async def process_record(record):
    website_url = record.get("website_url")
    feed_url = record.get("feed_url") or ""

    if not website_url:
        return {
            "line_index": record["line_index"],
            "status": "failed",
            "reason": "no_url",
        }

    content = None
    c_type = None

    # Try extraction with STRICT timeout wrapper
    try:
        # We wrap in wait_for because the underlying function ignores timeout
        res = await asyncio.wait_for(
            extract_favicon_and_canonical_url(website_url), timeout=20
        )
        if res:
            if res.image_content:
                content = res.image_content
                if res.image_format:
                    fmt = res.image_format.lower()
                    if "svg" in fmt:
                        c_type = "image/svg+xml"
                    elif "ico" in fmt:
                        c_type = "image/x-icon"
                    elif "jpeg" in fmt or "jpg" in fmt:
                        c_type = "image/jpeg"
            elif res.image_url:
                content, c_type = await _download_content(res.image_url, website_url)
    except asyncio.TimeoutError:
        return {
            "line_index": record["line_index"],
            "status": "failed",
            "reason": "timeout",
        }
    except Exception:
        pass

    if not content:
        return {
            "line_index": record["line_index"],
            "status": "failed",
            "reason": "extraction_failed",
        }

    # Validation & Saving logic
    save_type = None

    # 1. SVG Check
    is_svg = (
        (c_type and "svg" in c_type.lower())
        or (b"<svg" in content[:100].lower())
        or (b"<?xml" in content[:100].lower())
    )

    if is_svg:
        save_type = "image/svg+xml"
    else:
        try:
            with Image.open(io.BytesIO(content)) as img:
                save_type = img.get_format_mimetype()
        except Exception:
            return {
                "line_index": record["line_index"],
                "status": "failed",
                "reason": "invalid_image_content",
            }

    if save_type:
        # Save file
        # Use MD5 of feed_url for filename availability
        filename = hashlib.md5(feed_url.encode("utf-8")).hexdigest()
        save_path = FAVICONS_DIR / filename

        try:
            with open(save_path, "wb") as f:
                f.write(content)

            # Return relative path for jsonl
            rel_path = f"favicons/{filename}"
            return {
                "line_index": record["line_index"],
                "status": "success",
                "image_url": rel_path,
                "image_type": save_type,
            }
        except Exception as e:
            return {
                "line_index": record["line_index"],
                "status": "failed",
                "reason": f"save_error: {e}",
            }

    return {"line_index": record["line_index"], "status": "failed", "reason": "unknown"}


async def main():
    if not os.path.exists(BROKEN_FILE):
        print(f"No broken favicons file found at {BROKEN_FILE}")
        return

    records = []
    with open(BROKEN_FILE, "r") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    print(f"Attempting to refetch {len(records)} favicons...")

    # Deduplicate by normalized domain
    # We want to refetch only ONE unique domain if multiple broken records share it
    # We will then map the result back to all records sharing that domain later?
    # No, the user prompt said "make sure you can deduplicate website_url (by domain)."
    # Let's dedupe the list of tasks we create.

    from urllib.parse import urlparse

    def get_domain(url):
        try:
            return urlparse(url).netloc.lower().replace("www.", "")
        except:
            return ""

    unique_domains = {}
    deduped_records = []

    for rec in records:
        url = rec.get("website_url")
        if not url:
            continue
        domain = get_domain(url)
        if not domain:
            continue

        if domain not in unique_domains:
            unique_domains[domain] = rec
            deduped_records.append(rec)

    print(f"Deduced {len(records)} records to {len(deduped_records)} unique domains.")

    # Clear result file initially
    with open(RESULT_FILE, "w") as f:
        pass

    concurrency_limit = 20
    semaphore = asyncio.Semaphore(concurrency_limit)

    async def sem_task(rec):
        async with semaphore:
            return await process_record(rec)

    tasks = [sem_task(rec) for rec in deduped_records]

    success_count = 0
    failed_count = 0

    with open(RESULT_FILE, "a") as f:
        for fut in tqdm(
            asyncio.as_completed(tasks), total=len(tasks), desc="Refetching", unit="img"
        ):
            res = await fut
            f.write(json.dumps(res) + "\n")
            f.flush()
            if res["status"] == "success":
                success_count += 1
            else:
                failed_count += 1

    print(f"Refetch complete. Success: {success_count}, Failed: {failed_count}")
    print(f"Results saved to {RESULT_FILE}")


if __name__ == "__main__":
    asyncio.run(main())
