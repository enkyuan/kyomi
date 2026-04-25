import json
from collections import defaultdict
import os
import argparse


def main():
    parser = argparse.ArgumentParser(description="Output top feeds by category.")
    parser.add_argument(
        "--k",
        type=int,
        default=30,
        help="Number of top feeds to output per category (default: 30)",
    )
    parser.add_argument(
        "--lang", type=str, default="en", help="Language filter (default: 'en')"
    )
    parser.add_argument(
        "--input",
        type=str,
        default="feeds.jsonl",
        help="Input JSONL file (default: feeds.jsonl)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="top_feeds_by_category.md",
        help="Output Markdown file (default: top_feeds_by_category.md)",
    )

    args = parser.parse_args()

    input_file = args.input
    output_file = args.output
    target_lang = args.lang
    top_k = args.k

    feeds_by_category = defaultdict(list)

    print(f"Reading {input_file} (filtering for lang='{target_lang}')...")
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        return

    with open(input_file, "r", encoding="utf-8") as f:
        for line in f:
            try:
                feed = json.loads(line)
                if feed.get("language") != target_lang:
                    continue
                category = feed.get("category", "Uncategorized")
                if not category:
                    category = "Uncategorized"

                # Ensure popularity_score is a number
                score = feed.get("popularity_score", 0)
                if score is None:
                    score = 0
                feed["popularity_score"] = score

                feeds_by_category[category].append(feed)
            except json.JSONDecodeError:
                print(f"Skipping invalid JSON line: {line[:50]}...")
                continue

    print(f"Sorting and selecting top {top_k}...")
    sorted_categories = sorted(feeds_by_category.keys())

    with open(output_file, "w", encoding="utf-8") as out:
        out.write(f"# Top {top_k} Feeds per Category ({target_lang})\n\n")

        for category in sorted_categories:
            feeds = feeds_by_category[category]
            # Sort by popularity_score desc
            feeds.sort(key=lambda x: x["popularity_score"], reverse=True)

            top_feeds = feeds[:top_k]

            out.write(f"## {category}\n\n")
            out.write("| Rank | Score | Title | URL |\n")
            out.write("|---|---|---|---|\n")

            for i, feed in enumerate(top_feeds, 1):
                title = feed.get("title", "No Title").replace("|", r"\|")
                url = feed.get("website_url", feed.get("feed_url", ""))
                score = feed["popularity_score"]
                out.write(f"| {i} | {score} | [{title}]({url}) | {url} |\n")

            out.write("\n")

    print(f"Done. Output written to {output_file}")


if __name__ == "__main__":
    main()
