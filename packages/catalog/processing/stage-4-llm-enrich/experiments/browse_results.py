import json
import os
import sys
import signal

# Handle BrokenPipeError (when piping to head/tail)
signal.signal(signal.SIGPIPE, signal.SIG_DFL)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_FILE = os.path.join(BASE_DIR, "experiment_results.json")


def main():
    if not os.path.exists(RESULTS_FILE):
        print(f"Error: {RESULTS_FILE} not found.")
        return

    with open(RESULTS_FILE, "r") as f:
        data = json.load(f)

    # Sort by popularity score descending
    sorted_data = sorted(
        data, key=lambda x: x.get("output", {}).get("popularity_score", 0), reverse=True
    )

    print(f"Loaded {len(sorted_data)} records. Sorted by Popularity Score (Desc).\n")
    print("-" * 80)

    for i, item in enumerate(sorted_data, 1):
        out = item.get("output", {})
        inp = item.get("input", {})
        meta = item.get("meta", {})

        score = out.get("popularity_score", "N/A")
        title = out.get("clean_title") or inp.get("title") or "Unknown"
        category = out.get("category", "N/A")
        content_type = out.get("content_type", "N/A")
        desc = out.get("curated_description", "N/A")
        segment = meta.get("segment", "N/A")
        url = inp.get("url", "N/A")
        author = out.get("clean_author") or "N/A"
        tags_en = out.get("tags_en", [])
        tags_native = out.get("tags_native", [])

        print(f"#{i} [{score}] {title}")
        print(f"   URL:      {url}")
        print(f"   Category: {category} | Type: {content_type}")
        print(f"   Segment:  {segment}")
        print(f"   Author:   {author}")
        print(f"   Desc:     {desc}")
        print(f"   Tags (EN): {tags_en}")
        if tags_native:
            print(f"   Tags (Native): {tags_native}")
        print("-" * 80)


if __name__ == "__main__":
    main()
