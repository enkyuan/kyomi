import json
import glob
import os
import re
from urllib.parse import urlparse
import csv
from tranco import Tranco

# --- Configuration ---
FEEEED_DIR = "feeeed"
OPML_FILE = "opml_feeds.json"
FEEDSPOT_DIR = "feedspot"
FEEDSPOT_MAP_FILE = "category_map/feedspot.json"
OUTPUT_FILE = "unified_feeds.json"

# --- Helper Functions ---


from url_normalize import url_normalize


def normalize_url(url):
    if not url:
        return ""
    try:
        return url_normalize(url)
    except:
        return url.lower()


def extract_domain(url):
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        return parsed.netloc.lower().replace("www.", "")
    except:
        return ""


def load_feedspot_map():
    if os.path.exists(FEEDSPOT_MAP_FILE):
        with open(FEEDSPOT_MAP_FILE, "r") as f:
            return json.load(f)
    return {}


# --- Data Loading & Processing ---


def process_feeeed_data(feedspot_map, tranco_ranks):
    feeds = {}  # Key: normalized_feed_url, Value: UnifiedFeed object

    files = glob.glob(os.path.join(FEEEED_DIR, "*.json"))
    print(f"Processing {len(files)} feeeed files...")

    for f_path in files:
        try:
            with open(f_path, "r") as f:
                data = json.load(f)

            for item in data.get("feeds", []):
                feed_url = item.get("feed_url")
                if not feed_url:
                    continue

                norm_url = normalize_url(feed_url)
                domain = extract_domain(feed_url)

                # Map fields
                unified_feed = {
                    "title": item.get("cleaned_title") or item.get("title"),
                    "feed_url": feed_url,
                    "domain": domain,
                    "summary": item.get("summary") or item.get("description"),
                    "language": item.get("language", "en"),
                    "kind": item.get("kind", "feed"),
                    "category": item.get(
                        "top_level_category"
                    ),  # Already updated in previous step
                    "subcategory": item.get("details"),  # Already updated
                    "tags": item.get("tags", []),
                    "keywords": item.get("keywords", []),
                    "popularity_score": item.get("popularity_score"),
                    "tranco_rank": tranco_ranks.get(domain),
                    "image_url": item.get(
                        "thumbnail_url"
                    ),  # Will be overwritten by feedspot if available
                    "source_dataset": "feeeed",
                    "original_source_file": os.path.basename(f_path),
                    "author": item.get("cleaned_author"),
                    "channel_id": item.get("channel_id"),
                    "subreddit": item.get("subreddit"),
                    "bluesky_did": item.get("bluesky_did"),
                }

                feeds[norm_url] = unified_feed

        except Exception as e:
            print(f"Error reading {f_path}: {e}")

    return feeds


def process_opml_data(existing_feeds, tranco_ranks):
    print("Processing OPML data...")
    if not os.path.exists(OPML_FILE):
        print(f"Warning: {OPML_FILE} not found.")
        return existing_feeds

    try:
        with open(OPML_FILE, "r") as f:
            data = json.load(f)

        for item in data:
            xml_url = item.get("xmlUrl")
            if not xml_url:
                continue

            norm_url = normalize_url(xml_url)
            domain = extract_domain(xml_url)

            # If feed exists, merge/enrich. If not, add new.
            if norm_url in existing_feeds:
                # Merge logic: OPML is lowest priority, so mostly just add if missing
                feed = existing_feeds[norm_url]
                if not feed.get("website_url") and item.get("htmlUrl"):
                    feed["website_url"] = item.get("htmlUrl")
                # Don't overwrite title/summary from feeeed
            else:
                # Create new entry
                unified_feed = {
                    "title": item.get("title") or item.get("text"),
                    "feed_url": xml_url,
                    "website_url": item.get("htmlUrl"),
                    "domain": domain,
                    "summary": item.get("description"),
                    "language": "en",  # Default
                    "kind": "feed",
                    "category": None,
                    "subcategory": item.get(
                        "category"
                    ),  # Keep original category string here
                    "tranco_rank": tranco_ranks.get(domain),
                    "source_dataset": "opml",
                    "original_source_file": item.get("source_opml"),
                }
                existing_feeds[norm_url] = unified_feed

    except Exception as e:
        print(f"Error processing OPML data: {e}")

    return existing_feeds


def process_feedspot_data(existing_feeds, feedspot_map, tranco_ranks):
    print("Processing Feedspot data...")

    feedspot_files = glob.glob(os.path.join(FEEDSPOT_DIR, "*.json"))
    if not feedspot_files:
        print(f"No Feedspot data files found in {FEEDSPOT_DIR}. Skipping.")
        return existing_feeds

    print(f"Found {len(feedspot_files)} Feedspot files.")

    for f_path in feedspot_files:
        try:
            with open(f_path, "r") as f:
                data = json.load(f)
                # Assuming data is a list of feeds from scraper
                if isinstance(data, dict):  # Maybe it's single feed or wrapper
                    items = data.get("feeds", [data])
                else:
                    items = data

                # Extract top-level category if available
                top_level_category = (
                    data.get("category") if isinstance(data, dict) else None
                )

                for item in items:
                    feed_url = item.get("feed_url")
                    if not feed_url:
                        continue
                    norm_url = normalize_url(feed_url)
                    domain = extract_domain(feed_url)

                    # Feedspot is highest priority

                    # Map category
                    raw_cat = item.get("category") or top_level_category
                    mapped_cat = feedspot_map.get(raw_cat.lower()) if raw_cat else None

                    feed_data = {
                        "title": item.get("title"),
                        "feed_url": feed_url,
                        "website_url": item.get("website_url"),
                        "domain": domain,
                        "summary": item.get("description"),
                        "language": "en",
                        "kind": "feed",
                        "category": mapped_cat,
                        "subcategory": raw_cat,
                        "followers": item.get("followers"),
                        "tranco_rank": tranco_ranks.get(domain),
                        "image_url": item.get("image_url"),
                        "source_dataset": "feedspot",
                        "original_source_file": os.path.basename(f_path),
                    }

                    if norm_url in existing_feeds:
                        # Overwrite existing with Feedspot data
                        existing = existing_feeds[norm_url]
                        existing.update(feed_data)
                        # Keep tags/keywords from feeeed if they exist
                    else:
                        existing_feeds[norm_url] = feed_data

        except Exception as e:
            print(f"Error reading {f_path}: {e}")

    return existing_feeds


def load_tranco_ranks():
    print("Loading Tranco ranks...")
    try:
        t = Tranco(cache=True, cache_dir=".tranco_cache")
        # Get the latest list (e.g., top 1 million)
        # Note: Tranco list date might need to be specified or it defaults to latest available
        list_id = t.list().list_id
        print(f"Using Tranco list ID: {list_id}")
        # rank() returns the rank of a domain
        # But for efficiency, we might want to load the whole list if possible,
        # or just use the .rank() method which might query the API or local file.
        # The Tranco library downloads the list to cache.
        # Let's just return the Tranco object wrapper or a helper lambda
        # Actually, let's create a lookup dict for the top 1M to avoid repeated lookups if the lib is slow
        # But the lib is designed for this. Let's trust the lib's caching.
        # Wait, the lib's .rank() method takes a domain and returns rank.
        # To make it fast for 18k feeds, we should probably just use the lib object.
        # However, to match the signature expected by processing functions (a dict-like get),
        # we can wrap it.

        # Better approach: Download the list and read into a dict for O(1) lookup
        # The library stores the list as a CSV in cache_dir.
        # Let's just use the library's `list().top(1000000)` which returns a list of domains.
        top_domains = t.list().top(1000000)
        rank_lookup = {domain: rank + 1 for rank, domain in enumerate(top_domains)}
        print(f"Loaded {len(rank_lookup)} domains from Tranco.")
        return rank_lookup

    except Exception as e:
        print(f"Error loading Tranco ranks: {e}")
        return {}


def main():
    feedspot_map = load_feedspot_map()
    tranco_ranks = load_tranco_ranks()

    # 1. Start with feeeed (High quality metadata)
    feeds = process_feeeed_data(feedspot_map, tranco_ranks)

    # 2. Merge OPML (Volume, lower quality)
    feeds = process_opml_data(feeds, tranco_ranks)

    # 3. Merge Feedspot (High quality, social proof)
    feeds = process_feedspot_data(feeds, feedspot_map, tranco_ranks)

    # 4. Final cleanup & List conversion
    final_list = list(feeds.values())

    # 5. Save
    print(f"Saving {len(final_list)} unified feeds to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w") as f:
        json.dump(final_list, f, indent=2)

    print("Done.")


if __name__ == "__main__":
    main()
