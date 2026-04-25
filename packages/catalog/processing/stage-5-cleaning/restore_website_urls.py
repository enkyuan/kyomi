import json
import tqdm
import os

ENRICHED_FEEDS_PATH = (
    "/home/kamui/rss-r-us/processing/stage-2-fetching/enriched_feeds.jsonl"
)
FEEDS_FINAL_PATH = "/home/kamui/rss-r-us/processing/stage-5-final/feeds_final.jsonl"
OUTPUT_PATH = "/home/kamui/rss-r-us/processing/stage-5-final/feeds_restored.jsonl"


def restore_website_urls():
    # Cache website_urls from enriched_feeds
    url_cache = {}

    print(f"Reading {ENRICHED_FEEDS_PATH}...")
    if not os.path.exists(ENRICHED_FEEDS_PATH):
        print(f"Error: {ENRICHED_FEEDS_PATH} does not exist.")
        return

    with open(ENRICHED_FEEDS_PATH, "r") as f:
        # Use tqdm for progress. Since we don't know line count easily without scanning, just iterate.
        # But enriched_feeds is large (23GB according to history?), so tqdm is good.
        for line in tqdm.tqdm(f, desc="Caching enriched URLs"):
            try:
                data = json.loads(line)
                feed = data.get("feed", {})
                feed_url = feed.get("feed_url")
                website_url = feed.get("website_url")

                # key must be valid. If website_url is present (even if None? No, only truthy)
                # User instructions: "map it to cache[row['feed']['feed_url']]"
                # "select ['feed']['website_url']"
                # If website_url is missing/null, we probably shouldn't cache it as a replacement?
                # Assume we only want to restore VALID/EXISTING website_urls.
                if feed_url and website_url:
                    url_cache[feed_url] = website_url
            except json.JSONDecodeError:
                continue

    print(f"Loaded {len(url_cache)} website URLs into cache.")

    # Read feeds_final, update, and write to feeds_restored
    print(f"Reading {FEEDS_FINAL_PATH}...")
    if not os.path.exists(FEEDS_FINAL_PATH):
        print(f"Error: {FEEDS_FINAL_PATH} does not exist.")
        return

    updated_count = 0
    total_count = 0

    with open(OUTPUT_PATH, "w") as out_f:
        with open(FEEDS_FINAL_PATH, "r") as in_f:
            # We can load it all into memory if we want, but streaming is safer and we just need to write one by one.
            # But the user said "you can load feeds_final all into memory at once".
            # It might be faster to load, process in loop, verify, then write.
            # But given the task is simple row-by-row, streaming is fine.

            lines = in_f.readlines()
            for line in tqdm.tqdm(lines, desc="Restoring URLs"):
                try:
                    record = json.loads(line)
                    feed_url = record.get("feed_url")

                    if feed_url in url_cache:
                        # Restore
                        record["website_url"] = url_cache[feed_url]
                        updated_count += 1

                    out_f.write(json.dumps(record) + "\n")
                    total_count += 1
                except json.JSONDecodeError:
                    continue

    print(f"Finished processing {total_count} records.")
    print(f"Updated {updated_count} records with restored website URLs.")
    print(f"Wrote restored feeds to {OUTPUT_PATH}")


if __name__ == "__main__":
    restore_website_urls()
