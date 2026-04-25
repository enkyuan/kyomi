import asyncio
import logging
import json
import os
import sys
import io
import ssl
from urllib.parse import urlparse
from pathlib import Path
import hashlib
from tqdm import tqdm
import aiohttp
from PIL import Image

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from ingest import get_reader, get_writer

from feed.favicon import extract_favicon_and_canonical_url

logger = logging.getLogger(__name__)

# Constants
PRIORITY_SCORES = {"feedspot": 3, "feeeeed": 2, "opml": 1}
BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36"


def get_domain_from_url(url):
    try:
        if not url:
            return ""
        return urlparse(url).netloc
    except Exception:
        return ""


def get_normalized_domain(url):
    domain = get_domain_from_url(url)
    if domain.lower().startswith("www."):
        return domain[4:]
    return domain


def infer_url_from_items(record):
    """
    Infers website_url from the most recent article link in feed['items'].
    """
    items = record.get("items", [])
    if not items:
        return None

    # Check first item for a link
    candidate_link = None
    for item in items:
        if item.get("link"):
            candidate_link = item["link"]
            break
        if item.get("url"):
            candidate_link = item["url"]
            break

    if not candidate_link:
        return None

    try:
        parsed = urlparse(candidate_link)
        if not parsed.netloc:
            return None
        return f"{parsed.scheme}://{parsed.netloc}/"
    except Exception:
        return None


def calculate_priority_score(record):
    """
    Returns priority score based on source_dataset.
    """
    source = record.get("source_dataset", "opml")
    for key, val in PRIORITY_SCORES.items():
        if key in source.lower():
            return val
    return 1


class Pipeline:
    def __init__(
        self,
        input_path,
        output_path,
        favicons_dir="favicons",
        workers=50,
        limit=None,
    ):
        self.input_path = input_path
        self.output_path = output_path
        self.favicons_dir = Path(favicons_dir)
        self.workers = workers
        self.limit = limit
        self.winners_map = {}  # content_hash -> (priority_score, line_idx)
        self.total_lines = 0

        self.favicons_dir.mkdir(parents=True, exist_ok=True)

        # Setup failure logger
        self.failure_logger = logging.getLogger("failures")
        self.failure_logger.setLevel(logging.WARNING)
        if not self.failure_logger.handlers:
            fh_err = logging.FileHandler("failed_websites.log")
            fh_err.setFormatter(logging.Formatter("%(asctime)s - %(message)s"))
            self.failure_logger.addHandler(fh_err)
            self.failure_logger.propagate = False

    def run(self):
        logger.info(f"=== Starting Pipeline: {self.input_path} ===")
        self.phase_1_scan()
        asyncio.run(self.phase_2_process())
        logger.info("=== Pipeline Complete ===")

    def phase_1_scan(self):
        logger.info("--- Phase 1: Scan & Decide ---")
        reader = get_reader(self.input_path)
        count = 0

        for line_idx, line in tqdm(enumerate(reader), desc="Scanning", unit=" feeds"):
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            # Identify content hash
            feed_data = record["feed"]
            c_hash = feed_data["content_hash"]

            p_score = calculate_priority_score(record)

            # Winner Logic
            current_best = self.winners_map.get(c_hash)
            is_better = False

            if not current_best:
                is_better = True
            else:
                old_p, _ = current_best
                if p_score > old_p:
                    is_better = True

            if is_better:
                self.winners_map[c_hash] = (p_score, line_idx)

            count += 1

        self.total_lines = count
        logger.info(
            f"Phase 1 Complete. Scanned {count} feeds. Unique Winners: {len(self.winners_map)}"
        )

    def _enrich_record(self, record):
        feed_obj = record["feed"]

        # 1. Validate/Clean existing website_url
        if feed_obj.get("website_url"):
            try:
                parsed = urlparse(feed_obj["website_url"])
                if not (parsed.scheme in ["http", "https"] and parsed.netloc):
                    feed_obj["website_url"] = None
            except Exception:
                feed_obj["website_url"] = None

        # 2. Ensure website_url is present (infer if missing)
        if not feed_obj.get("website_url"):
            inferred = infer_url_from_items(record)
            if inferred:
                feed_obj["website_url"] = inferred

        # 3. Domain & Tranco (store in feed object)
        url_for_domain = feed_obj.get("website_url") or feed_obj.get("feed_url") or ""
        domain = get_normalized_domain(url_for_domain)
        feed_obj["domain"] = domain

        # no need to precompute this into dataset for now
        if "tranco_rank" in feed_obj:
            del feed_obj["tranco_rank"]
        return record

    async def _run_pass(
        self, writer, desc, predicate, winning_indices, process_all, pbar
    ):
        logger.info(f"--- Starting Pass: {desc} ---")
        reader = get_reader(self.input_path)
        pending = set()

        def handle_done(done_tasks):
            success_count = 0
            for t in done_tasks:
                try:
                    res = t.result()
                    if res and writer:
                        writer.write(json.dumps(res) + "\n")
                    success_count += 1
                except Exception as e:
                    logger.error(f"Task failed: {e}")
            if pbar:
                pbar.update(success_count)

        for line_idx, line in enumerate(reader):
            # Check global limit via pbar
            if self.limit and pbar.n >= self.limit:
                break

            # Filter by Phase 1 winners
            if not process_all and line_idx not in winning_indices:
                continue

            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            # Filter by Pass Predicate
            if not predicate(record):
                continue

            # Enrich
            record = self._enrich_record(record)

            # Start streaming task
            task = asyncio.create_task(self.process_single_item(record))
            pending.add(task)

            # Limit Concurrency
            if len(pending) >= self.workers:
                done, pending = await asyncio.wait(
                    pending, return_when=asyncio.FIRST_COMPLETED
                )
                handle_done(done)

        # Flush remaining for this pass
        if pending:
            done, _ = await asyncio.wait(pending, return_when=asyncio.ALL_COMPLETED)
            handle_done(done)

        return

    async def phase_2_process(self):
        logger.info("--- Phase 2: Process & Fetch (Multi-Pass) ---")

        winning_indices = {v[1] for v in self.winners_map.values()}
        process_all = len(winning_indices) == 0

        total_items = len(winning_indices) if not process_all else self.total_lines
        if self.limit:
            total_items = min(total_items, self.limit)

        writer = get_writer(self.output_path)

        # Single Progress Bar for total items processed
        with tqdm(total=total_items, desc="Processing", unit=" feeds") as pbar:

            # Pass 1: Feedspot Priority
            # Prioritize these so they populate the disk cache first
            await self._run_pass(
                writer,
                "Feedspot Priority",
                lambda r: "feedspot" == r["feed"]["source_dataset"],
                winning_indices,
                process_all,
                pbar,
            )

            # Pass 2: Everything Else
            if not self.limit or pbar.n < self.limit:
                await self._run_pass(
                    writer,
                    "Remaining Feeds",
                    lambda r: "feedspot" != r["feed"]["source_dataset"],
                    winning_indices,
                    process_all,
                    pbar,
                )

        if writer:
            writer.close()

        logger.info("Phase 2 Complete.")

    async def _download_content(self, url, log_context_url):
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
                    else:
                        self.failure_logger.warning(
                            f"Failed to download image {url}: HTTP {resp.status} (Feed: {log_context_url})"
                        )
        except Exception as e:
            self.failure_logger.error(f"Download exception for {url}: {e}")
        return None, None

    async def _try_extraction(self, feed_obj, website_url):
        content = None
        c_type = None
        try:
            res = await extrimage_contentact_favicon_and_canonical_url(website_url, timeout=10)
            if res:
                if res.image_content:
                    content = res.image_content
                    # Map format to mime type
                    if res.image_format:
                        fmt = res.image_format.lower()
                        if "svg" in fmt:
                            c_type = "image/svg+xml"
                        elif "ico" in fmt:
                            c_type = "image/x-icon"
                        elif "jpeg" in fmt or "jpg" in fmt:
                            c_type = "image/jpeg"
                        # We will refine c_type with detection later
                elif res.image_url:
                    content, c_type = await self._download_content(
                        res.image_url, website_url
                    )
                else:
                    self.failure_logger.warning(
                        f"No image URL found after extraction for {website_url}"
                    )
        except Exception as e:
            self.failure_logger.error(
                f"Extraction process failed for {website_url}: {e}"
            )
        return content, c_type

    def _save_favicon(self, feed_obj, filename, content, c_type):
        feed_obj["image_type"] = None

        # 1. SVG Check
        is_svg = (
            (c_type and "svg" in c_type.lower())
            or (b"<svg" in content[:100].lower())
            or (b"<?xml" in content[:100].lower())
        )

        if is_svg:
            c_type = "image/svg+xml"
        else:
            # 2. Raster Check (Pillow)
            try:
                with Image.open(io.BytesIO(content)) as img:
                    c_type = img.get_format_mimetype()
            except Exception:
                # Log first 200 bytes to help debug (e.g. if we got HTML 403/404 page masquerading as 200 OK)
                snippet = content[:200]
                try:
                    snippet_str = snippet.decode("utf-8", errors="replace")
                except:
                    snippet_str = repr(snippet)

                self.failure_logger.warning(
                    f"Corrupted or unsupported image in save for {filename}. Content snippet: {snippet_str!r}"
                )
                feed_obj["image_url"] = None
                return

        if c_type:
            feed_obj["image_type"] = c_type.split(";")[0].strip()

        final_path = self.favicons_dir / filename
        try:
            with open(final_path, "wb") as f:
                f.write(content)
            feed_obj["image_url"] = str(final_path)
        except Exception as e:
            self.failure_logger.error(f"Failed to save favicon {filename}: {e}")
            feed_obj["image_url"] = None

    async def process_single_item(self, record):
        """
        Fetches favicon, saves to disk, updates record['feed'].
        Hybrid Strategy:
        1. If 'image_url' exists -> Fetch & Save as hash(feed_url).
        2. Else -> Check Domain Cache -> Reuse if exists.
        3. Else -> Extract -> Save as domain_name.
        """
        feed_obj = record["feed"]
        domain = feed_obj.get("domain")

        # Get Feed URL for hashing
        feed_url = (
            feed_obj.get("feed_url")
            or record.get("feed_url")
            or feed_obj.get("website_url")
            or ""
        )
        website_url = (
            feed_obj.get("website_url")
            or feed_obj.get("feed_url")
            or record.get("feed_url")
        )

        if not domain or not website_url:
            return record

        content = None
        c_type = None

        # --- Path A: Existing Explicit Image ---
        if feed_obj.get("image_url"):
            # Ensure it's not a local path (cleanup from previous runs if any)
            if not str(feed_obj["image_url"]).startswith("/"):
                content, c_type = await self._download_content(
                    feed_obj["image_url"], website_url
                )
                if content:
                    # Strategy: Hash of Feed URL
                    filename = hashlib.md5(feed_url.encode("utf-8")).hexdigest()
                    self._save_favicon(feed_obj, filename, content, c_type)
                    return record
                else:
                    # Download failed, fall through to fallback
                    self.failure_logger.warning(
                        f"Falling back to domain favicon for {website_url}"
                    )

        # --- Path B: Domain Cache Check ---
        # Domain is already normalized (no www)
        # We use strict domain name as filename
        domain_filename = domain
        final_path = self.favicons_dir / domain_filename

        if final_path.exists():
            # HIT: Use cached domain favicon
            try:
                # We read just enough to verify or retrieve mime type?
                # Actually pipeline just needs path. But let's try to get mime type.
                # Opening file is cheap.
                feed_obj["image_url"] = str(final_path)
                # Optional: Re-detect type if missing
                if not feed_obj.get("image_type"):
                    with open(final_path, "rb") as f:
                        header = f.read(100)
                        if b"<svg" in header.lower():
                            feed_obj["image_type"] = "image/svg+xml"
                        else:
                            # We can lazy init or skip
                            pass
                return record
            except Exception:
                pass

        # --- Path C: Extraction ---
        content, c_type = await self._try_extraction(feed_obj, website_url)
        if content:
            # Strategy: Domain Name
            self._save_favicon(feed_obj, domain_filename, content, c_type)
        else:
            feed_obj["image_url"] = None

        return record
