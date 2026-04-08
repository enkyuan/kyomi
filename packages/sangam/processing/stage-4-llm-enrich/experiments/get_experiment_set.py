import json
import os
import sys
import random
import xml.etree.ElementTree as ET
from collections import defaultdict
from urllib.parse import urlparse

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))
from readspace.language_detection import detect_feed_language

INPUT_FILE = "processing/stage-4-llm-enrich/feeds_llm_input.jsonl"
OUTPUT_FILE = "processing/stage-4-llm-enrich/evaluation_set.json"

OPML_FILES = [
    "inputs/opml/elink-world-news.opml",
    "inputs/opml/categorized-rss.opml",
    "inputs/opml/more_categorized.opml",
    "inputs/opml/whirlpool.opml",
    "inputs/opml/techlore.opml",
    "inputs/opml/us_news_feeds.opml",
    "inputs/opml/top-rss-zh.opml",
]

TARGET_OPML_MATCHES = 20
TARGET_LANG_ZH = 10
TARGET_LANG_JA = 10
TARGET_LANG_OTHER = 10
TARGET_EDGE_CASES = 25
TOTAL_TARGET = (
    TARGET_OPML_MATCHES
    + TARGET_LANG_ZH
    + TARGET_LANG_JA
    + TARGET_LANG_OTHER
    + TARGET_EDGE_CASES
)


def parse_opml_urls(opml_paths):
    urls = set()
    for path in opml_paths:
        if not os.path.exists(path):
            print(f"Warning: OPML file not found: {path}")
            continue
        try:
            tree = ET.parse(path)
            root = tree.getroot()
            for outline in root.findall(".//outline"):
                xml_url = outline.get("xmlUrl")
                if xml_url:
                    urls.add(xml_url.rstrip("/"))
        except Exception as e:
            print(f"Error parsing {path}: {e}")
    return urls


def normalize_url(url):
    return (url or "").rstrip("/")


def main():
    print(f"Reading OPMLs...")
    opml_urls = parse_opml_urls(OPML_FILES)
    print(f"Found {len(opml_urls)} unique OPML target URLs.")

    print(f"Reading from {INPUT_FILE}...")

    candidates = {
        "opml_match": [],
        "lang_zh": [],
        "lang_ja": [],
        "lang_en": [],
        "lang_other": [],  # Store (lang, record) tuples
        "edge_null_summary": [],
        "edge_null_desc": [],
        "edge_one_item": [],
        "edge_short_title": [],
        "random_pool": [],
    }

    count = 0
    try:
        with open(INPUT_FILE, "r") as f:
            for line in f:
                try:
                    record = json.loads(line)
                    count += 1
                    if count % 1000 == 0:
                        print(f"Processed {count} records...", end="\r")

                    feed = record.get("feed", {})
                    items = record.get("items", []) or []

                    feed_url = normalize_url(feed.get("feed_url"))
                    website_url = normalize_url(feed.get("website_url"))

                    # 1. OPML Match
                    matched_opml = False
                    if feed_url in opml_urls or website_url in opml_urls:
                        candidates["opml_match"].append(record)
                        matched_opml = True

                    # 2. Language Detect
                    # Use title, parsed_description (fallback for summary often), and item titles/summaries
                    # We pass raw item texts to detector
                    sample_texts = [
                        i.get("title", "") + " " + i.get("summary", "")
                        for i in items[:5]
                    ]
                    lang = detect_feed_language(
                        feed.get("title"),
                        feed.get("parsed_description") or feed.get("summary"),
                        sample_texts,
                    )

                    # Store for language targets (if not already picked as OPML match to avoid double counting for now,
                    # though overlap is fine, we just want to ensure we have enough of each)
                    if lang == "zh":
                        candidates["lang_zh"].append(record)
                    elif lang == "ja":
                        candidates["lang_ja"].append(record)
                    elif lang == "en":
                        candidates["lang_en"].append(record)
                    else:
                        candidates["lang_other"].append((lang, record))

                    # 3. Edge Cases
                    summary = feed.get("summary")
                    desc = feed.get("parsed_description")
                    title = feed.get("title") or ""

                    if not summary:
                        candidates["edge_null_summary"].append(record)
                    if not desc:
                        candidates["edge_null_desc"].append(record)
                    if len(items) == 1:
                        candidates["edge_one_item"].append(record)
                    if len(title) < 10:
                        candidates["edge_short_title"].append(record)

                    # 4. Random Pool
                    candidates["random_pool"].append(record)

                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        print(f"Error: Could not find {INPUT_FILE}")
        return

    print(f"\nFinished reading {count} records.")

    # Select Experiment Set
    final_set = []
    selected_urls = set()

    def add_record(rec, segment, reason):
        url = rec.get("feed", {}).get("feed_url")
        if url in selected_urls:
            return
        selected_urls.add(url)
        final_set.append(
            {"segment": segment, "description": reason, "why": reason, "record": rec}
        )

    # Helper to pick N items from a list
    def pick_n(source_list, n, segment, reason_prefix):
        # random.sample throws if n > len, so handle that
        k = min(n, len(source_list))
        picked = random.sample(source_list, k)
        for p in picked:
            # If source_list has tuples (lang_other), unpack
            if isinstance(p, tuple) and segment == "Language Diversity (Other)":
                rec = p[1]
                r = f"{reason_prefix} ({p[0]})"
            else:
                rec = p
                r = reason_prefix
            add_record(rec, segment, r)

    print("Selecting candidates...")

    # 1. OPML Matches
    pick_n(
        candidates["opml_match"],
        TARGET_OPML_MATCHES,
        "OPML Match",
        "Feed found in target OPMLs",
    )

    # 2. Languages
    pick_n(
        candidates["lang_zh"],
        TARGET_LANG_ZH,
        "Language Diversity (ZH)",
        "Detected Language: Chinese",
    )
    pick_n(
        candidates["lang_ja"],
        TARGET_LANG_JA,
        "Language Diversity (JA)",
        "Detected Language: Japanese",
    )
    pick_n(
        candidates["lang_en"],
        TARGET_LANG_EN,
        "Language Diversity (EN)",
        "Detected Language: English",
    )

    # For Other, we want distinct languages if possible.
    # Group by lang first
    other_by_lang = defaultdict(list)
    for lang, rec in candidates["lang_other"]:
        other_by_lang[lang].append(rec)

    # Try to pick 1 from each other lang until we hit target
    other_langs = list(other_by_lang.keys())
    random.shuffle(other_langs)
    picked_other = 0
    for l in other_langs:
        if picked_other >= TARGET_LANG_OTHER:
            break
        rec = random.choice(other_by_lang[l])
        add_record(rec, "Language Diversity (Other)", f"Detected Language: {l}")
        picked_other += 1

    # 3. Edge Cases
    pick_n(
        candidates["edge_null_summary"],
        TARGET_EDGE_CASES,
        "Edge Case",
        "Summary is Null/Empty",
    )
    pick_n(
        candidates["edge_null_desc"],
        TARGET_EDGE_CASES,
        "Edge Case",
        "Parsed Description is Null/Empty",
    )
    pick_n(
        candidates["edge_one_item"],
        TARGET_EDGE_CASES,
        "Edge Case",
        "Items list has exactly 1 item",
    )
    pick_n(
        candidates["edge_short_title"],
        TARGET_EDGE_CASES,
        "Edge Case",
        "Title is very short (< 10 chars)",
    )

    # 4. Fill Remainder with Random
    remaining_needed = TOTAL_TARGET - len(final_set)
    if remaining_needed > 0:
        # Filter random pool to exclude already selected
        available_random = [
            r
            for r in candidates["random_pool"]
            if r.get("feed", {}).get("feed_url") not in selected_urls
        ]
        pick_n(
            available_random,
            remaining_needed,
            "Random Sample",
            "Randomly selected for coverage",
        )

    # Summary
    print(f"\nSelection Complete. Total: {len(final_set)}")
    segments = defaultdict(int)
    for item in final_set:
        segments[item["segment"]] += 1
    for seg, count in segments.items():
        print(f"  - {seg}: {count}")

    # Save
    with open(OUTPUT_FILE, "w") as f:
        json.dump({"experiment_set": final_set}, f, indent=2, ensure_ascii=False)
    print(f"Saved evaluation set to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
