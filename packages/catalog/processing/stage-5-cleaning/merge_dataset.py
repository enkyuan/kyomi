import json
import os
from typing import Dict, Any, List
from tqdm import tqdm

# Paths
STAGE_3_INPUT_FILE = (
    "/home/kamui/rss-r-us/processing/stage-3-favicon-dedupe/stage_3_feeds.jsonl"
)
ENRICHED_INPUT_FILE = (
    "/home/kamui/rss-r-us/processing/stage-4-llm-enrich/feeds_enriched.jsonl"
)
OUTPUT_FILE_NO_ARTICLES = (
    "/home/kamui/rss-r-us/processing/stage-5-final/feeds_final.jsonl"
)
OUTPUT_FILE_ARTICLES = (
    "/home/kamui/rss-r-us/processing/stage-5-final/feeds_articles.jsonl"
)


def load_enriched_feeds(path: str) -> Dict[str, Dict[str, Any]]:
    """Load enriched feeds into a dictionary keyed by feed_url."""
    print(f"Loading enriched feeds from {path}...")
    enriched_map = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in tqdm(f, desc="Loading Enriched"):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
                enriched_map[row["feed_url"]] = row
            except json.JSONDecodeError:
                continue
    print(f"Loaded {len(enriched_map)} enriched feeds.")
    return enriched_map


def process_merge():
    """
    Process stage 3 dataset, merge with enriched data, and output final datasets.
    """
    enriched_map = load_enriched_feeds(ENRICHED_INPUT_FILE)

    print(f"Processing {STAGE_3_INPUT_FILE}...")

    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE_NO_ARTICLES), exist_ok=True)

    processed_count = 0
    match_count = 0
    url_mismatch_count = 0

    with (
        open(STAGE_3_INPUT_FILE, "r", encoding="utf-8") as fin,
        open(OUTPUT_FILE_NO_ARTICLES, "w", encoding="utf-8") as fout_no_items,
        open(OUTPUT_FILE_ARTICLES, "w", encoding="utf-8") as fout_articles,
    ):

        for line in tqdm(fin, desc="Merging"):
            if not line.strip():
                continue

            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            processed_count += 1

            # Extract Original Feed
            orig_feed = record.get("feed", {})
            feed_url = orig_feed.get("feed_url")

            if not feed_url:
                continue

            # Validate that feed_url matches fetch_details.final_url
            final_url = record.get("fetch_details", {}).get("final_url")
            if final_url and feed_url != final_url:
                url_mismatch_count += 1
                feed_url = final_url

            # Find Match
            if feed_url in enriched_map:
                match_count += 1
                enriched_data = enriched_map[feed_url]

                # --- Construction of Final Object ---

                # 1. Base from Original (Preserved Fields)
                final_feed = {}

                # Core Identifiers (Https conversion)
                final_feed["feed_url"] = feed_url
                final_feed["website_url"] = orig_feed.get("website_url", "")

                # Media & Lineage (Keep Original)
                final_feed["image_url"] = orig_feed.get("image_url", "")
                final_feed["image_type"] = orig_feed.get("image_type", "")
                final_feed["followers"] = orig_feed.get("followers", {})
                final_feed["source_dataset"] = orig_feed.get("source_dataset", "")
                final_feed["original_source_file"] = orig_feed.get(
                    "original_source_file", ""
                )
                final_feed["content_hash"] = orig_feed.get("content_hash", "")
                final_feed["original_summary"] = orig_feed.get("parsed_description", "")

                # Stats (From Record.stats)
                final_feed["stats"] = record.get("stats", {})

                # 2. Overwrite/Merge from LLM Enriched
                # Replace original language, summary, title, tags, category, author

                final_feed["title"] = orig_feed.get("title", "")
                final_feed["summary"] = enriched_data.get(
                    "curated_description", ""
                )  # 'curated_description' -> 'summary'
                final_feed["language"] = enriched_data.get(
                    "language_code", ""
                )  # 'language_code' -> 'language'
                final_feed["category"] = enriched_data.get("category", "")
                final_feed["content_type"] = enriched_data.get("content_type", "")
                final_feed["author"] = enriched_data.get("author")  # Nullable
                if orig_feed.get("popularity_score") is not None:
                    final_feed["original_popularity"] = orig_feed.get(
                        "popularity_score"
                    )
                final_feed["popularity_score"] = enriched_data.get(
                    "popularity_score", 0
                )

                # Tags: Lowercase conversion
                tags_en = enriched_data.get("tags_en", [])
                tags_native = enriched_data.get("tags_native", [])

                final_feed["tags"] = [t.lower() for t in tags_en] if tags_en else []
                final_feed["tags_native"] = (
                    [t.lower() for t in tags_native] if tags_native else []
                )

                # 3. Output

                # Dataset 1: Without Articles
                fout_no_items.write(json.dumps(final_feed, ensure_ascii=False) + "\n")

                # Dataset 2: Articles to JSONL (Flattened)
                items = record.get("items", [])
                if items:
                    for item in items:
                        # Construct flattened article object
                        article_row = {
                            "feed_url": feed_url,
                            "title": item.get("title", ""),
                            "link": item.get("link", ""),
                            "published_at": item.get("published_at"),
                            "summary": item.get("summary", ""),
                            "content_html": item.get("content_html", ""),
                            "author": item.get("author"),
                            "guid": item.get("guid", ""),
                            "image_url": item.get("image_url"),
                            "tags": item.get("tags", []),
                        }
                        fout_articles.write(
                            json.dumps(article_row, ensure_ascii=False) + "\n"
                        )

    print(f"Processing Complete.")
    print(f"Processed {processed_count} stage 3 records.")
    print(f"Skipped {url_mismatch_count} records due to URL mismatch.")
    print(f"Matched and Merged {match_count} records.")
    print(f"Outputs:\n  - {OUTPUT_FILE_NO_ARTICLES}\n  - {OUTPUT_FILE_ARTICLES}")


if __name__ == "__main__":
    process_merge()
