import json
import re
import sys


def parse_error_log(log_file):
    """
    Parses the error log and returns a set of row indices (1-based) that match the criteria.
    Criteria:
    1. "Invalid category" AND "Invalid content_type"
    2. "Language mismatch in description"
    """
    target_rows = set()

    # Regex for Row number: "Row (\d+) FAIL"
    row_pattern = re.compile(r"Row (\d+) FAIL")

    # specific rows requested by user
    target_rows = {6075, 105934}
    return target_rows

    # The logic below is disabled to focus only on the specific rows above
    """
    with open(log_file, "r") as f:
        for line in f:
            if "FAIL" not in line:
                continue

            match = row_pattern.search(line)
            if not match:
                continue

            row_num = int(match.group(1))

            # Condition 1: Schema/Metadata Error
            if "Invalid category" in line and "Invalid content_type" in line:
                target_rows.add(row_num)

            # Condition 2: Language Mismatch
            elif "Language mismatch in description" in line:
                target_rows.add(row_num)
    """
    return target_rows


def get_failed_urls(merged_file, target_rows):
    """
    Reads the merged file and extracts URLs for the specified row numbers.
    row_numbers are 1-based.
    """
    failed_urls = set()

    with open(merged_file, "r") as f:
        for i, line in enumerate(f):
            current_row = i + 1
            if current_row in target_rows:
                try:
                    data = json.loads(line)
                    url = data.get("feed_url")
                    if url:
                        failed_urls.add(url)
                except json.JSONDecodeError:
                    pass

    return failed_urls


def extract_original_feeds(input_file, failed_urls, output_file):
    """
    Reads input file and writes lines for matching URLs to output file.
    """
    count = 0
    with open(input_file, "r") as fin, open(output_file, "w") as fout:
        for line in fin:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                url = None
                # Handle nested feed object or flat structure
                if "feed" in data and isinstance(data["feed"], dict):
                    url = data["feed"].get("feed_url")
                elif "feed_url" in data:
                    url = data.get("feed_url")

                # Check feed_url
                if url and url in failed_urls:
                    fout.write(line)
                    count += 1
                    continue

                # Fallback: Check website_url if available
                # Sometimes the merged URL might be the website URL (data quality issue?)
                website_url = None
                if "feed" in data and isinstance(data["feed"], dict):
                    website_url = data["feed"].get("website_url")
                elif "website_url" in data:
                    website_url = data.get("website_url")

                if website_url and website_url in failed_urls:
                    fout.write(line)
                    count += 1
            except json.JSONDecodeError:
                pass

    print(f"Extracted {count} feeds to {output_file}")


def main():
    log_file = "enriched_feeds_merged.jsonl.errors.log"
    merged_file = "enriched_feeds_merged.jsonl"
    input_file = "feeds_llm_input.jsonl"
    output_file = "feeds_to_retry_manual.jsonl"

    print(f"Scanning {log_file} for specific errors...")
    target_rows = parse_error_log(log_file)
    print(f"Found {len(target_rows)} rows matching criteria.")

    if not target_rows:
        print("No matching rows found.")
        return

    print(f"Extracting URLs from {merged_file}...")
    failed_urls = get_failed_urls(merged_file, target_rows)
    print(f"Found {len(failed_urls)} URLs corresponding to failed rows.")

    print(f"Extracting original input data from {input_file}...")
    extract_original_feeds(input_file, failed_urls, output_file)


if __name__ == "__main__":
    main()
