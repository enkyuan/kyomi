import json
from collections import defaultdict
import sys
from datetime import datetime

# Configuration
INPUT_FILE = "feeds_restored.jsonl"
OUTPUT_JSONL = "duplicates_exact_title_and_site.jsonl"
OUTPUT_MD = "duplicates_report.md"


def format_timestamp(ts):
    if not ts:
        return "N/A"
    try:
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return str(ts)


def main():
    print(f"Reading {INPUT_FILE}...")
    # Key is tuple: (title, website_url)
    grouped_map = defaultdict(list)
    count = 0

    try:
        with open(INPUT_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    raw_title = data.get("title")
                    raw_website = data.get("website_url")

                    if raw_title is None:
                        continue

                    # Normalize: strip whitespace.
                    title = raw_title.strip()
                    website = raw_website.strip() if raw_website else ""

                    if not title:
                        continue

                    # We are grouping by Title AND Website URL
                    key = (title, website)

                    # Extract fields for report
                    record = {
                        "title": raw_title,
                        "website_url": raw_website,
                        "feed_url": data.get("feed_url"),
                        "stats": data.get("stats", {}),
                    }

                    grouped_map[key].append(record)
                    count += 1
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON: {e}")

        print(f"Processed {count} records.")
        print("Analyzing duplicates (Same Title + Same Website URL)...")

        # Filter for duplicates
        duplicates = {k: recs for k, recs in grouped_map.items() if len(recs) > 1}

        print(f"Found {len(duplicates)} groups with identical Title AND Website URL.")
        total_dupe_records = sum(len(recs) for recs in duplicates.values())
        print(f"Total affected records: {total_dupe_records}")

        # 1. Write JSONL output
        with open(OUTPUT_JSONL, "w", encoding="utf-8") as out_json:
            for (title, website), records in duplicates.items():
                output_obj = {
                    "title": title,
                    "website_url": website,
                    "count": len(records),
                    "records": records,
                }
                out_json.write(json.dumps(output_obj, ensure_ascii=False) + "\n")

        # 2. Write Readable Markdown Report
        with open(OUTPUT_MD, "w", encoding="utf-8") as out_md:
            out_md.write(f"# Duplicate Report (Same Title & Website URL)\n")
            out_md.write(
                f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            )
            out_md.write(f"- Total Groups: {len(duplicates)}\n")
            out_md.write(f"- Total Records: {total_dupe_records}\n\n")
            out_md.write("---\n\n")

            for (title, website), records in duplicates.items():
                out_md.write(f'### Title: "{title}"\n')
                out_md.write(f"**Website**: `{website}`\n\n")

                out_md.write(
                    "| Feed URL | Last Post | Posts/Week | Median Interval |\n"
                )
                out_md.write("|---|---|---|---|\n")

                for r in records:
                    stats = r.get("stats") or {}
                    last_post = format_timestamp(stats.get("last_post_date"))
                    ppw = stats.get("posts_per_week", 0)
                    interval = stats.get("median_post_interval", 0)

                    feed_url = r["feed_url"]

                    out_md.write(
                        f"| `{feed_url}` | {last_post} | {ppw} | {interval} |\n"
                    )
                out_md.write("\n---\n\n")

        print(f"JSONL report written to {OUTPUT_JSONL}")
        print(f"Readable Markdown report written to {OUTPUT_MD}")

    except FileNotFoundError:
        print(f"Error: File {INPUT_FILE} not found.")
        sys.exit(1)


if __name__ == "__main__":
    main()
