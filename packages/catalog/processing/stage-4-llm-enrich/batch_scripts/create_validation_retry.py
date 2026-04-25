import json
import re
import sys
import os


def load_urls_from_input(filename):
    """
    Scans the input file and returns a dictionary mapping feed_url -> valid raw JSON line (string).
    This allows us to quickly retrieve the original line for creating the retry file.
    Note: Storing all lines in memory might be heavy if the file is huge (23GB was mentioned previously).
    If it's too large, we should just store the set of target URLs and iterate the file again.

    Given the constraints and previous valid scripts, we'll assume we iterate 'feeds_llm_input.jsonl'
    a second time for writing, rather than storing 23GB in memory.
    """
    # We won't load the whole file here, just use this function if we needed to build a map.
    # Instead, we will iterate efficiently later.
    pass


def get_failed_rows_from_log(log_filename):
    """
    Parses the error log to find row numbers that failed validation.
    Returns a set of integers (1-based row numbers).
    """
    failed_rows = set()
    try:
        with open(log_filename, "r") as f:
            for line in f:
                # Look for patterns like "ERROR: Row 482 FAIL:"
                match = re.search(r"ERROR: Row (\d+) FAIL:", line)
                if match:
                    row_num = int(match.group(1))
                    failed_rows.add(row_num)
    except FileNotFoundError:
        print(f"Error log file not found: {log_filename}")
        sys.exit(1)
    return failed_rows


def get_failed_urls(merged_filename, failed_rows):
    """
    Reads the merged output file and retrieves feed_urls for the specified row numbers.
    failed_rows is a set of 1-based indices.
    """
    failed_urls = set()
    current_row = 0
    try:
        with open(merged_filename, "r") as f:
            for line in f:
                current_row += 1
                if current_row in failed_rows:
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        if "feed_url" in data:
                            failed_urls.add(data["feed_url"])
                    except json.JSONDecodeError:
                        pass
    except FileNotFoundError:
        print(f"Merged output file not found: {merged_filename}")
        sys.exit(1)

    return failed_urls


def create_retry_file(input_filename, retry_filename, target_urls):
    """
    Reads input_filename. If a record's feed_url is in target_urls, writes the line to retry_filename.
    """
    count = 0
    print(f"Scanning input file {input_filename} for {len(target_urls)} failed URLs...")

    with open(input_filename, "r") as fin, open(retry_filename, "w") as fout:
        for line in fin:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                url = None
                # Handle both input format (wrapped in 'feed' or flat)
                if "feed_url" in data:
                    url = data["feed_url"]
                elif "feed" in data and isinstance(data["feed"], dict):
                    url = data["feed"].get("feed_url")

                if url and url in target_urls:
                    fout.write(line)
                    count += 1
            except json.JSONDecodeError:
                pass

    print(f"Wrote {count} lines to {retry_filename}")


def main():
    # File names assumed to be in current directory, matching debug_extra_feeds.py pattern
    input_file = "feeds_llm_input.jsonl"
    merged_file = "enriched_feeds_merged.jsonl"
    error_log_file = "enriched_feeds_merged.jsonl.errors.log"
    retry_file = "enriched_feeds_merged.validation_retry.jsonl"

    # Allow overriding via arguments if needed, but default to current dir files
    if len(sys.argv) >= 4:
        input_file = sys.argv[1]
        merged_file = sys.argv[2]
        error_log_file = sys.argv[3]

    if not os.path.exists(error_log_file):
        print(f"Error: Log file '{error_log_file}' not found.")
        print(
            "Please ensure you are running this from the directory containing the processing files,"
        )
        print("or that you have run the validation script first.")
        return

    print(f"Parsing error log: {error_log_file}")
    failed_rows = get_failed_rows_from_log(error_log_file)
    print(f"Found {len(failed_rows)} failed rows in log.")

    if not failed_rows:
        print("No failed rows found. Exiting.")
        return

    print(f"Extracting URLs from merged file: {merged_file}")
    failed_urls = get_failed_urls(merged_file, failed_rows)
    print(f"Found {len(failed_urls)} unique URLs corresponding to failed rows.")

    print(f"Generating retry file: {retry_file}")
    create_retry_file(input_file, retry_file, failed_urls)


if __name__ == "__main__":
    main()
