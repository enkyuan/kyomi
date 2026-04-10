import json
import sys


def load_urls(filename):
    urls = set()
    with open(filename, "r") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                # Handle both input format (wrapped in 'feed' or flat) and output format
                url = None
                if "feed_url" in data:
                    url = data["feed_url"]
                elif "feed" in data and isinstance(data["feed"], dict):
                    url = data["feed"].get("feed_url")

                if url:
                    urls.add(url)
            except:
                pass
    return urls


def main():
    input_file = "feeds_llm_input.jsonl"
    merged_file = "enriched_feeds_merged.jsonl"

    print("Loading input URLs...")
    input_urls = load_urls(input_file)
    print(f"Input Unique URLs: {len(input_urls)}")

    print("Loading merged output URLs...")
    merged_urls = load_urls(merged_file)
    print(f"Merged Unique URLs: {len(merged_urls)}")

    missing = input_urls - merged_urls
    print(f"URLs in Input but MISSING in Output: {len(missing)}")

    if missing:
        print("\nSample Missing URLs:")
        for i, url in enumerate(list(missing)[:20]):
            print(f" - {url}")

    # Check validity of this check by ensuring we aren't just seeing slash mismatches causing false positives
    print(
        "\nChecking for near matches (trailing slash differences) in missing items..."
    )
    matches = 0
    for url in missing:
        # Check if stripping/adding slash finds it in merged
        alt1 = url.rstrip("/")
        alt2 = url + "/"
        if alt1 in merged_urls or alt2 in merged_urls:
            matches += 1

    print(f"False Positives due to Slash Mismatches: {matches}")
    print(f"TRUE MISSING COUNT: {len(missing) - matches}")

    if missing:
        retry_file = f"{merged_file}.retry.jsonl"
        print(f"\nGenerating retry file: {retry_file}")

        count = 0
        with open(input_file, "r") as fin, open(retry_file, "w") as fout:
            for line in fin:
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    url = None
                    if "feed" in data and isinstance(data["feed"], dict):
                        url = data["feed"].get("feed_url")
                    elif "feed_url" in data:
                        url = data.get("feed_url")

                    if url and url in missing:
                        fout.write(line)
                        count += 1
                except json.JSONDecodeError:
                    pass
        print(f"Wrote {count} lines to {retry_file}")


if __name__ == "__main__":
    main()
