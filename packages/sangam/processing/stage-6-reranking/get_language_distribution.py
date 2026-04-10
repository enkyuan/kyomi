import json
from collections import Counter
import sys


def get_language_distribution(file_path):
    lang_counts = Counter()
    total_count = 0

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    lang = data.get("language")
                    # handle None or missing
                    if lang is None:
                        lang = "None"
                    lang_counts[lang] += 1
                    total_count += 1
                except json.JSONDecodeError:
                    print(f"Skipping invalid JSON line", file=sys.stderr)
                    continue
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return

    print(f"Total records: {total_count}")
    print("\nLanguage Distribution:")
    print(f"{'Language':<10} | {'Count':<10} | {'Percentage':<10}")
    print("-" * 35)

    for lang, count in lang_counts.most_common():
        percentage = (count / total_count) * 100
        print(f"{lang:<10} | {count:<10} | {percentage:.2f}%")


if __name__ == "__main__":
    file_path = "feeds.jsonl"
    get_language_distribution(file_path)
