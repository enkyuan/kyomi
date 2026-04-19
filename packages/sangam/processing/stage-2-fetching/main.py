#!/usr/bin/env python3
import asyncio
import random
import json
import logging
import signal
import sys
import os
import argparse
from datetime import datetime
from typing import List, Dict, Any, Set
from tqdm.asyncio import tqdm

# Setup imports
# Add project root for feed imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
# Add local directory for local imports
sys.path.append(os.path.dirname(__file__))

from storage import FeedCache
from enrichment import Enricher
from feed.fetching import fetch_feed_content
from feed.parsing import parse_feed_content

# Configure logging
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)

# Formatter
formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")

# File Handler for all logs (INFO+)
file_handler = logging.FileHandler("pipeline.log")
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(formatter)
root_logger.addHandler(file_handler)

# File Handler for errors (WARNING+)
error_file_handler = logging.FileHandler("pipeline_errors.log")
error_file_handler.setLevel(logging.WARNING)
error_file_handler.setFormatter(formatter)
root_logger.addHandler(error_file_handler)

logger = logging.getLogger(__name__)


class Pipeline:
    def __init__(
        self,
        input_file: str,
        output_file: str,
        db_path: str,
        workers: int = 20,
        retry_dropped_file: str = None,
    ):
        self.input_file = input_file
        self.output_file = output_file
        self.cache = FeedCache(db_path)
        self.enricher = Enricher()
        self.workers = workers
        self.retry_dropped_file = retry_dropped_file
        self._shutdown = False
        self.dropped_feeds = []

    def load_feeds(self) -> List[Dict[str, Any]]:
        if self.retry_dropped_file:
            return self.load_dropped_feeds()

        with open(self.input_file, "r") as f:
            return json.load(f)

    def load_dropped_feeds(self) -> List[Dict[str, Any]]:
        logger.info(f"Loading dropped feeds from {self.retry_dropped_file}...")
        with open(self.retry_dropped_file, "r") as f:
            dropped_data = json.load(f)

        # Create error lookup map: URL -> Error Message
        # We also use this to track which URLs we need to retry
        error_map = {}
        for item in dropped_data:
            url = item.get("url")
            if url:
                # Store the first error encountered for this URL if duplicates exist
                if url not in error_map:
                    error_map[url] = item.get("error", "")

        # Load original inputs to recover metadata (source_dataset, etc)
        # We must assume self.input_file is valid and contains the original feeds
        logger.info(
            f"Loading original feeds from {self.input_file} to recover metadata..."
        )
        with open(self.input_file, "r") as f:
            original_feeds = json.load(f)

        feeds_to_retry = []
        skipped_error_counts = {}

        # Set of URLs we are looking for
        target_urls = set(error_map.keys())

        # Match original feeds to dropped errors
        for feed in original_feeds:
            url = feed.get("feed_url")
            if url in target_urls:
                error = error_map[url]

                # Filtering conditions
                should_skip = False

                if "No items found" in error:
                    should_skip = True
                elif "HTTP 404" in error:
                    should_skip = True
                elif "HTTP 403" in error:
                    should_skip = True
                elif "RSSHub routes disabled" in error:
                    should_skip = True
                elif "Unexpected error" in error:
                    should_skip = True
                elif "Feed content too large" in error:
                    should_skip = True

                if should_skip:
                    # Log stats
                    key = error.split(":")[0] if ":" in error else error
                    skipped_error_counts[key] = skipped_error_counts.get(key, 0) + 1
                else:
                    feeds_to_retry.append(feed)

        logger.info(f"Retry Mode: Loaded {len(dropped_data)} dropped entries.")
        logger.info(f"Retry Mode: Found {len(target_urls)} unique dropped URLs.")
        logger.info(
            f"Retry Mode: Queued {len(feeds_to_retry)} feeds for retry (after matching and filtering)."
        )
        logger.info(f"Retry Mode: Skipped stats: {skipped_error_counts}")

        # Randomize to avoid Cloudflare blocking on sequential access
        random.shuffle(feeds_to_retry)

        return feeds_to_retry

    async def process_feed(self, feed: Dict[str, Any]):
        if self._shutdown:
            return None, None

        url = feed.get("feed_url")
        if not url:
            return None, None

        if "rsshub.app" in url:
            logger.info(f"Skipping {url}: RSSHub routes are currently disabled.")
            return None, {
                "url": url,
                "error": "RSSHub routes disabled",
                "reason": "rsshub_disabled",
            }

        # Check cache metadata
        cached_meta = self.cache.get_metadata(url)
        etag = cached_meta.get("etag") if cached_meta else None
        last_modified = cached_meta.get("http_last_modified") if cached_meta else None

        # 1. Fetch
        # Using feed.fetching
        fetch_result = await fetch_feed_content(
            url, etag=etag, last_modified=last_modified
        )

        # Handle 304 Not Modified
        if fetch_result["status_code"] == 304:
            self.cache.touch(url)
            return self.cache.get(url), None

        # Handle Errors
        if fetch_result["error"] or fetch_result["status_code"] >= 400:
            error_msg = fetch_result["error"] or f"HTTP {fetch_result['status_code']}"
            logger.warning(f"Error fetching {url}: {error_msg}")
            return None, {"url": url, "error": error_msg, "reason": "fetch_error"}

        # 2. Parse
        # Using feed.parsing
        try:
            parsed = parse_feed_content(
                fetch_result["content"], fetch_result["final_url"] or url
            )
        except Exception as e:
            logger.error(f"Error parsing {url}: {e}")
            return None, {"url": url, "error": str(e), "reason": "parse_error"}

        if not parsed.get("items"):
            logger.warning(f"Skipping {url}: No items found in feed.")
            return None, {"url": url, "error": "No items found", "reason": "empty_feed"}

        # 2. Format Items
        formatted_items = []
        for item in parsed.get("items", []):
            formatted_items.append(
                {
                    "title": item.get("title"),
                    "link": item.get("link"),
                    "published_at": (
                        item.get("published_at").timestamp()
                        if item.get("published_at")
                        else None
                    ),
                    "summary": item.get("summary"),
                    # "content": item.get("content"), # Excluded from final dataset
                    "content_html": item.get("content_html"),
                    "author": item.get("author"),
                    "guid": item.get("guid"),
                    "image_url": item.get("image_url"),
                    "tags": item.get("tags", []),
                }
            )

        # 3. Enrich (Stats)
        stats = self.enricher.calculate_stats(formatted_items)

        # 4. Enrich (Language)
        # Priority: Parsed (if available) > Feed Metadata (if available) > Detection
        lang = parsed.get("language") or feed.get("language")

        # If language is still missing or unreliable source (opml), run detection
        if not lang or feed.get("source_dataset") == "opml":
            detected = self.enricher.detect_feed_language(
                parsed["title"], parsed.get("parsed_description"), formatted_items
            )
            # Only override if we detected something
            if detected:
                lang = detected

        # 5. Enrich (Favicon)
        # Handle simple fallback
        image_url = feed.get("image_url") or parsed.get("image_url")

        # Handle Redirects (Update feed_url if permanent redirect)
        final_url = fetch_result.get("final_url")
        is_perm_redirect = fetch_result.get("permanent_redirect")
        current_feed_url = final_url if (is_perm_redirect and final_url) else url

        # Calculate ID for deduplication
        # Content Hash: 5 recent articles, essential fields
        import hashlib

        # Sort by date descending to get most recent
        sorted_items = sorted(
            formatted_items, key=lambda x: x.get("published_at") or 0, reverse=True
        )
        recent_items = sorted_items[:5]

        hash_payload = []
        for item in recent_items:
            hash_payload.append(
                {
                    "title": item.get("title"),
                    "link": item.get("link"),
                    "published_at": item.get("published_at"),
                    "summary": item.get("summary"),
                    "content_html": item.get("content_html"),
                }
            )

        content_hash = hashlib.sha256(
            json.dumps(hash_payload, sort_keys=True).encode("utf-8")
        ).hexdigest()

        # Construct Enriched Object
        enriched_feed = {
            "feed": {
                **feed,
                "feed_url": current_feed_url,  # Update URL if redirected
                "title": feed.get("title") or parsed.get("title"),
                "language": lang,
                "image_url": image_url,
                "author": parsed.get("feed_author") or feed.get("author"),
                "parsed_description": parsed.get("parsed_description"),
                "parsed_tags": parsed.get("parsed_tags", []),
                "content_hash": content_hash,  # For Stage 3 deduplication
            },
            "items": formatted_items,
            "fetch_details": {
                "fetch_date": datetime.now().timestamp(),
                "http_status": fetch_result["status_code"],
                "http_etag": fetch_result["headers"].get("ETag")
                or fetch_result["headers"].get("etag"),
                "http_last_modified": fetch_result["headers"].get("Last-Modified")
                or fetch_result["headers"].get("last-modified"),
                "content_hash": content_hash,
                "server_header": fetch_result["headers"].get("Server")
                or fetch_result["headers"].get("server"),
                "final_url": final_url,
                "permanent_redirect": is_perm_redirect,
            },
            "stats": stats,
        }

        if feed.get("source_dataset") == "opml":
            enriched_feed["feed"]["title"] = parsed.get("title") or feed.get("title")
            enriched_feed["feed"]["website_url"] = parsed.get("link") or feed.get(
                "website_url"
            )

        # 6. Store
        self.cache.set(url, enriched_feed)

        return enriched_feed, None

    def get_processed_urls(self) -> Set[str]:
        urls = set()
        if not os.path.exists(self.output_file):
            return urls

        logger.info(f"Scanning {self.output_file} for existing feeds...")
        try:
            with open(self.output_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        if "feed" in data and "feed_url" in data["feed"]:
                            urls.add(data["feed"]["feed_url"])
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.warning(f"Error reading output file: {e}")

        return urls

    async def run(self):
        feeds = self.load_feeds()
        processed_urls = self.get_processed_urls()

        initial_count = len(feeds)
        feeds = [f for f in feeds if f.get("feed_url") not in processed_urls]
        skipped_count = initial_count - len(feeds)

        logger.info(
            f"Loaded {initial_count} feeds. Skipped {skipped_count} already processed. "
            f"Starting processing with {self.workers} workers on {len(feeds)} remaining feeds."
        )

        semaphore = asyncio.Semaphore(self.workers)
        queue = asyncio.Queue()

        async def worker(feed):
            async with semaphore:
                try:
                    res, dropped = await self.process_feed(feed)
                    if res:
                        await queue.put(res)
                    if dropped:
                        self.dropped_feeds.append(dropped)
                except Exception as e:
                    logger.error(f"Worker error on {feed.get('feed_url')}: {e}")

        async def writer():
            count = 0
            mode = "a" if skipped_count > 0 else "w"
            with open(self.output_file, mode) as f:
                while True:
                    item = await queue.get()
                    if item is None:  # Sentinel
                        queue.task_done()
                        break

                    json.dump(item, f, ensure_ascii=False)
                    f.write("\n")
                    count += 1
                    queue.task_done()
            return count

        # Start writer
        writer_task = asyncio.create_task(writer())

        # Start workers
        tasks = [asyncio.create_task(worker(feed)) for feed in feeds]

        # Monitor progress
        for f in tqdm(
            asyncio.as_completed(tasks), total=len(tasks), desc="Fetching feeds"
        ):
            await f

        # Signal completion to writer
        await queue.put(None)

        # Wait for writer
        count = await writer_task
        logger.info(f"Exported {count} enriched feeds to {self.output_file}")

        # Write Dropped Feeds
        dropped_file = os.path.join(
            os.path.dirname(self.output_file), "dropped_feeds.json"
        )
        with open(dropped_file, "w") as f:
            json.dump(self.dropped_feeds, f, indent=2, ensure_ascii=False)
        logger.info(
            f"Exported {len(self.dropped_feeds)} dropped feeds to {dropped_file}"
        )


def signal_handler(sig, frame):
    logger.info("Interrupt received, shutting down...")
    sys.exit(0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Input unified_feeds.json")
    parser.add_argument("--output", required=True, help="Output enriched_feeds.json")
    parser.add_argument("--db", default="feeds.db", help="SQLite database path")
    parser.add_argument(
        "--workers", type=int, default=20, help="Number of concurrent workers"
    )
    parser.add_argument(
        "--retry-dropped",
        help="Path to dropped_feeds.json to retry. If set, --input is ignored for loading feeds.",
    )
    args = parser.parse_args()

    signal.signal(signal.SIGINT, signal_handler)

    pipeline = Pipeline(
        args.input,
        args.output,
        args.db,
        args.workers,
        retry_dropped_file=args.retry_dropped,
    )
    asyncio.run(pipeline.run())
