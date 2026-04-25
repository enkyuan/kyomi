import concurrent.futures
import json
import os
import random
import sys
import time
import argparse
import requests
from urllib.parse import urlparse

# Add the current directory to sys.path to allow importing scraper
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scraper import scrape_feedspot

MAX_WORKERS = 20  # Increased concurrency
OUTPUT_DIR = "processing/feedspot/data"
FAILED_URLS_FILE = "processing/feedspot/failed_urls.txt"
PROCESSED_URLS_FILE = "processing/feedspot/processed_urls.txt"
SITEMAP_FILE = "processing/feedspot/feedspot_sitemap.txt"

def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)

def load_processed_urls():
    if not os.path.exists(PROCESSED_URLS_FILE):
        return set()
    with open(PROCESSED_URLS_FILE, 'r') as f:
        return set(line.strip() for line in f if line.strip())

def log_processed_url(url):
    with open(PROCESSED_URLS_FILE, 'a') as f:
        f.write(f"{url}\n")

def process_url(url):
    """
    Process a single URL: scrape, handle errors, save result.
    Returns (success, url, error_message)
    """
    url = url.strip()
    if not url:
        return False, url, "Empty URL"

    max_retries = 10
    base_delay = 5  # Seconds

    for attempt in range(max_retries):
        # Rate limiting / Jitter
        if attempt == 0:
            # Fast first attempt
            time.sleep(random.uniform(0.1, 0.5))
        else:
            # Backoff for retries
            sleep_time = random.uniform(2.0, 5.0) + (attempt * base_delay)
            print(f"Retry {attempt}/{max_retries} for {url} after {sleep_time:.2f}s...")
            time.sleep(sleep_time)

        try:
            print(f"Scraping: {url}")
            feeds, category = scrape_feedspot(url)
            
            if not feeds and not category:
                 # This might be a parsing error or empty page, not necessarily a network error
                 return False, url, "No data found"

            # Sanitize category for filename
            safe_category = "".join([c for c in category if c.isalpha() or c.isdigit() or c in (' ', '-', '_')]).strip()
            if not safe_category:
                # Fallback to using the URL slug if category is missing
                path = urlparse(url).path
                safe_category = path.strip('/').replace('/', '_')
            
            filename = f"{safe_category}.json"
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            data = {
                "category": category,
                "source_url": url,
                "feeds": feeds
            }
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            
            # Log success immediately
            log_processed_url(url)
            return True, url, None

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            if status_code in [405, 429, 500, 502, 503, 504]:
                print(f"Hit {status_code} for {url}. Backing off.")
                # Exponential backoff with jitter
                wait_time = (2 ** attempt) * 30 + random.uniform(1, 10)
                print(f"Waiting {wait_time:.2f}s before retry...")
                time.sleep(wait_time)
                continue
            else:
                return False, url, str(e)
        except Exception as e:
            return False, url, str(e)

    return False, url, f"Max retries exceeded"

def main():
    parser = argparse.ArgumentParser(description="Batch scrape Feedspot URLs.")
    parser.add_argument("--limit", type=int, default=0, help="Limit the number of URLs to process (0 for all).")
    args = parser.parse_args()

    ensure_dir(OUTPUT_DIR)
    
    # Clear or create failed URLs file if it doesn't exist (append mode used later)
    if not os.path.exists(FAILED_URLS_FILE):
        with open(FAILED_URLS_FILE, 'w') as f:
            pass

    processed_urls = load_processed_urls()
    print(f"Loaded {len(processed_urls)} processed URLs.")

    all_urls = []
    try:
        with open(SITEMAP_FILE, 'r') as f:
            all_urls = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"Error: Sitemap file not found at {SITEMAP_FILE}")
        return

    # Filter out processed URLs
    urls_to_process = [url for url in all_urls if url not in processed_urls]
    print(f"Found {len(all_urls)} total URLs. {len(urls_to_process)} remaining to process.")

    if args.limit > 0:
        urls_to_process = urls_to_process[:args.limit]
        print(f"Limiting to first {args.limit} URLs.")

    print(f"Starting batch scrape for {len(urls_to_process)} URLs with {MAX_WORKERS} workers...")

    failed_count = 0
    success_count = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_url = {executor.submit(process_url, url): url for url in urls_to_process}
        
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            try:
                success, url, error = future.result()
                if success:
                    print(f"SUCCESS: {url}")
                    success_count += 1
                else:
                    print(f"FAILED: {url} - {error}")
                    failed_count += 1
                    with open(FAILED_URLS_FILE, 'a') as f:
                        f.write(f"{url} | {error}\n")
            except Exception as exc:
                print(f"EXCEPTION: {url} generated an exception: {exc}")
                failed_count += 1
                with open(FAILED_URLS_FILE, 'a') as f:
                    f.write(f"{url} | Exception: {exc}\n")

    print("\nBatch scraping completed.")
    print(f"Successful: {success_count}")
    print(f"Failed: {failed_count}")
    print(f"Data saved to: {OUTPUT_DIR}")
    print(f"Failed URLs saved to: {FAILED_URLS_FILE}")
    print(f"Processed URLs log: {PROCESSED_URLS_FILE}")

if __name__ == "__main__":
    main()
