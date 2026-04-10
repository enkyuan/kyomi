import json
import os
import sys
from collections import Counter
from urllib.parse import urlparse

INPUT_FILE = "processing/stage-4-llm-enrich/feeds_llm_input.jsonl"


def detect_language_tld(url):
    try:
        domain = urlparse(url).netloc
        parts = domain.split(".")
        if len(parts) > 1:
            tld = parts[-1]
            # Common generic TLDs to ignore for language inference
            if tld in [
                "com",
                "org",
                "net",
                "io",
                "dev",
                "app",
                "xyz",
                "info",
                "biz",
                "co",
            ]:
                return "generic"
            return tld
    except:
        pass
    return "unknown"


def main():
    print(f"Analyzing {INPUT_FILE}...")

    stats = {
        "total": 0,
        "sources": Counter(),
        "tlds": Counter(),
        "categories": Counter(),
        "edge_cases": {
            "null_summary": 0,
            "null_parsed_description": 0,
            "empty_items": 0,
            "single_item": 0,
            "short_title": 0,
            "null_category": 0,
        },
    }

    try:
        with open(INPUT_FILE, "r") as f:
            for line in f:
                try:
                    record = json.loads(line)
                    stats["total"] += 1

                    feed = record.get("feed", {})
                    items = record.get("items", [])

                    # Source
                    src = feed.get("source_dataset", "unknown")
                    stats["sources"][src] += 1

                    # TLD/Language proxy
                    url = feed.get("feed_url") or feed.get("website_url") or ""
                    tld = detect_language_tld(url)
                    stats["tlds"][tld] += 1

                    # Category
                    cat = feed.get("category")
                    if cat:
                        stats["categories"][cat] += 1
                    else:
                        stats["edge_cases"]["null_category"] += 1

                    # Edge Cases
                    if not feed.get("summary"):
                        stats["edge_cases"]["null_summary"] += 1

                    if not feed.get("parsed_description"):
                        stats["edge_cases"]["null_parsed_description"] += 1

                    if len(items) == 0:
                        stats["edge_cases"]["empty_items"] += 1
                    elif len(items) == 1:
                        stats["edge_cases"]["single_item"] += 1

                    if len(feed.get("title", "")) < 10:
                        stats["edge_cases"]["short_title"] += 1

                except json.JSONDecodeError:
                    continue

    except FileNotFoundError:
        print(f"File not found: {INPUT_FILE}")
        return

    print(f"\nTotal Records: {stats['total']}")

    print("\n--- Sources ---")
    for k, v in stats["sources"].most_common(10):
        print(f"{k}: {v}")

    print("\n--- Top TLDs (Language Proxy) ---")
    for k, v in stats["tlds"].most_common(20):
        print(f"{k}: {v}")

    print("\n--- Top Categories ---")
    for k, v in stats["categories"].most_common(10):
        print(f"{k}: {v}")

    print("\n--- Edge Cases ---")
    for k, v in stats["edge_cases"].items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
