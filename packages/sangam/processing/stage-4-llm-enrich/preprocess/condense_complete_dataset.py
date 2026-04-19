import json
import os
import sys
import datetime
import random
from tqdm import tqdm

# Add project root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))
from feed.parsing import convert_to_markdown, clean_html_text

INPUT_FILE = "processing/stage-3-favicon-dedupe/stage_3_feeds.jsonl"
OUTPUT_FILE = "processing/stage-4-llm-enrich/feeds_llm_input.jsonl"
ERROR_FILE = "processing/stage-4-llm-enrich/feeds_llm_input_errors.log"

# To align with run_experiment.py, we might want to sample similarly or not.
# Since we are processing the *entire* dataset, we probably can't use the exact same random sample
# logic if we want deterministic results, but random.sample is fine for now as requested.


def format_number(num):
    if num is None or num == "":
        return None
    try:
        val = float(num)
    except (ValueError, TypeError):
        return str(num)

    if val >= 1_000_000_000:
        return f"{val / 1_000_000_000:.1f}B"
    if val >= 1_000_000:
        return f"{val / 1_000_000:.1f}M"
    if val >= 1_000:
        return f"{val / 1_000:.1f}K"
    return str(int(val))


def format_interval(seconds):
    if not seconds:
        return "N/A"
    try:
        seconds = float(seconds)
    except (ValueError, TypeError):
        return "N/A"

    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    d, h = divmod(h, 24)
    if d > 0:
        return f"{int(d)}d {int(h)}h"
    if h > 0:
        return f"{int(h)}h {int(m)}m"
    return f"{int(m)}m"


def prune_empty(data):
    """
    Recursively remove keys/items that are None, [], "", or {}.
    Preserves 0 and False.
    """
    if isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            cleaned = prune_empty(v)
            if cleaned not in [None, [], "", {}]:
                new_dict[k] = cleaned
        return new_dict
    elif isinstance(data, list):
        new_list = []
        for v in data:
            cleaned = prune_empty(v)
            if cleaned not in [None, [], "", {}]:
                new_list.append(cleaned)
        return new_list
    return data


def process_record(record):
    # Mapping and Sanitize Logic aligned with run_experiment.py

    original_feed = record.get("feed", {})
    original_items = record.get("items", [])
    original_stats = record.get("stats", {})

    # 1. Feed
    feed = {}
    # Basic copy of fields present in data and schema
    feed["title"] = original_feed.get("title") or ""
    feed["feed_url"] = original_feed.get("feed_url") or ""
    # feed["domain"] = original_feed.get("domain") or ""
    feed["summary"] = original_feed.get("summary")

    # ALIGNMENT: run_experiment.py removes language to force LLM detection.
    # We will exclude it here too to align.
    feed.pop("language", None)
    feed.pop("domain", None)

    feed["category"] = original_feed.get("category")
    feed["subcategory"] = original_feed.get("subcategory")
    feed["tags"] = original_feed.get("tags") or []
    feed["author"] = original_feed.get("author")
    feed["website_url"] = original_feed.get("website_url") or ""

    # followers
    followers_data = original_feed.get("followers")
    if followers_data and isinstance(followers_data, dict):
        feed["followers"] = {
            "facebook": format_number(followers_data.get("facebook")),
            "twitter": format_number(followers_data.get("twitter")),
            "instagram": format_number(followers_data.get("instagram")),
        }
    else:
        feed["followers"] = None

    # parsed_description
    desc = original_feed.get("parsed_description") or ""
    if len(desc) > 500:
        desc = desc[:497] + "..."
    feed["parsed_description"] = desc

    # parsed_tags
    p_tags = original_feed.get("parsed_tags") or []
    if len(p_tags) > 10:
        p_tags = random.sample(p_tags, 10)
    feed["parsed_tags"] = p_tags

    # 2. Stats
    stats = {}
    stats["posts_per_week"] = float(original_stats.get("posts_per_week", 0.0))
    stats["median_post_interval"] = format_interval(
        original_stats.get("median_post_interval")
    )

    # 3. Items
    items = []
    # Limit to 5 items to save tokens
    for item in original_items[:5]:
        new_item = {}
        new_item["title"] = clean_html_text(item.get("title", ""))
        if len(new_item["title"]) > 200:
            new_item["title"] = new_item["title"][:197] + "..."

        new_item["link"] = item.get("link") or ""

        # Published at
        pub_at = item.get("published_at")
        if isinstance(pub_at, (int, float)):
            try:
                dt = datetime.datetime.fromtimestamp(pub_at)
                new_item["published_at"] = dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                new_item["published_at"] = None
        else:
            new_item["published_at"] = str(pub_at) if pub_at else None

        # Summary Logic:
        # 1. Use existing summary if it looks substantial (> 50 chars)
        # 2. Else, fallback to content_markdown preview
        # 3. Always clear content_markdown to save space

        raw_summary = clean_html_text(item.get("summary", ""))

        content_markdown = ""
        # Get content markdown just in case we need it for fallback
        c_html = item.get("content_html")
        if c_html:
            try:
                content_markdown = convert_to_markdown(c_html)
            except Exception:
                content_markdown = ""

        final_summary = raw_summary

        # Fallback if summary is weak but content is strong
        if len(raw_summary) < 50 and len(content_markdown) > 50:
            final_summary = content_markdown[:497] + "..."
        elif len(final_summary) > 500:
            final_summary = final_summary[:497] + "..."

        new_item["summary"] = final_summary

        new_item["author"] = item.get("author")

        # Tags
        i_tags = item.get("tags") or []
        if len(i_tags) > 5:
            i_tags = random.sample(i_tags, 5)
        new_item["tags"] = i_tags

        # Clear content_markdown to save massive space
        new_item["content_markdown"] = None

        items.append(new_item)

    processed = {"feed": feed, "items": items, "stats": stats}
    return prune_empty(processed)


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return

    # Count lines first for tqdm (using wc -l usually faster but just doing it here is fine or explicit arg)
    print(f"Processing {INPUT_FILE} to {OUTPUT_FILE}...")
    total_lines = 142862  # As reported by user

    count = 0
    errors = 0

    # Clear error log
    with open(ERROR_FILE, "w") as f:
        f.write(f"Error Log - {datetime.datetime.now()}\n")

    with (
        open(INPUT_FILE, "r") as fin,
        open(OUTPUT_FILE, "w") as fout,
        open(ERROR_FILE, "a") as ferr,
    ):
        # Use tqdm for progress bar
        for line in tqdm(fin, total=total_lines, unit="records"):
            try:
                if not line.strip():
                    continue
                record = json.loads(line)
                processed = process_record(record)

                # Check if processed is empty (unlikely unless everything was pruned)
                if processed:
                    fout.write(json.dumps(processed, ensure_ascii=False) + "\n")
                    count += 1
            except json.JSONDecodeError as e:
                errors += 1
                ferr.write(f"JSONDecodeError: {e} | Line: {line[:100]}...\n")
                continue
            except Exception as e:
                errors += 1
                ferr.write(f"Error: {e} | Line: {line[:100]}...\n")
                continue

    print(f"\nDone. Processed {count} records. Errors/Skipped: {errors}")
    print(f"Errors logged to {ERROR_FILE}")

    # Print file size
    if os.path.exists(OUTPUT_FILE):
        size = os.path.getsize(OUTPUT_FILE)
        print(f"Resulting file size: {size / (1024*1024):.2f} MB")


if __name__ == "__main__":
    main()
