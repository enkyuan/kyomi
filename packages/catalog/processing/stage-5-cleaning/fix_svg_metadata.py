import json
import os

FEEDS_FILE = "feeds.jsonl"
MISMATCH_FILE = "svg_mismatches.jsonl"
TEMP_FILE = "feeds.jsonl.tmp"


def fix_metadata():
    if not os.path.exists(MISMATCH_FILE):
        print(f"No mismatch file found at {MISMATCH_FILE}")
        return

    # Load targets
    targets = set()
    with open(MISMATCH_FILE, "r") as f:
        for line in f:
            if line.strip():
                try:
                    rec = json.loads(line)
                    targets.add(rec["line_index"])
                except:
                    pass

    print(f"Found {len(targets)} records to update.")

    updated_count = 0

    with open(FEEDS_FILE, "r") as infile, open(TEMP_FILE, "w") as outfile:
        for i, line in enumerate(infile):
            if i in targets:
                try:
                    record = json.loads(line)
                    record["image_type"] = "image/svg+xml"
                    outfile.write(json.dumps(record) + "\n")
                    updated_count += 1
                except:
                    # If parse fails, just write original line (shouldn't happen given previous scans)
                    outfile.write(line)
            else:
                outfile.write(line)

    print(f"Updated {updated_count} records.")

    # Overwrite original
    os.replace(TEMP_FILE, FEEDS_FILE)
    print(f"Replaced {FEEDS_FILE} with fixed version.")


if __name__ == "__main__":
    fix_metadata()
