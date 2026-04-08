import json
import os
import sys
import logging
from PIL import Image

# Path constants
FEEDS_FILE = "feeds.jsonl"
FAVICONS_DIR = "../stage-3-favicon-dedupe/favicons/"


def is_valid_image(path):
    # Check if empty
    if os.path.getsize(path) == 0:
        logging.warning(f"Empty file: {path}")
        return False

    # Check for SVG
    try:
        with open(path, "rb") as f:
            header = f.read(100)
            if b"svg" in header.lower() or b"xml" in header.lower():
                return True
    except:
        logging.warning(f"Failed to read SVG header: {path}")
        return False

    # Check with PIL
    try:
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception as e:
        # logging.warning(f"Failed to verify image: {path}: {e}")
        return False


def is_svg(path):
    try:
        with open(path, "rb") as f:
            header = f.read(100)
            # Simple heuristic matching what was used before
            if b"svg" in header.lower() or b"xml" in header.lower():
                return True
    except:
        return False
    return False


def audit():
    missing_records = []
    broken_records = []
    svg_mismatch_records = []

    print(f"Auditing {FEEDS_FILE}...")

    with open(FEEDS_FILE, "r") as f:
        lines = f.readlines()

    for i, line in enumerate(lines):
        try:
            record = json.loads(line)
        except:
            continue

        img_url = record.get("image_url")
        img_type = record.get("image_type")

        if img_url:
            basename = os.path.basename(img_url)
            full_path = os.path.join(FAVICONS_DIR, basename)

            error_entry = {
                "line_index": i,
                "feed_url": record.get("feed_url"),
                "curr_image_url": img_url,
                "curr_image_type": img_type,
            }

            if not os.path.exists(full_path):
                missing_records.append(error_entry)
            else:
                # 1. Check if file is corrupt
                if not is_valid_image(full_path):
                    broken_records.append(error_entry)

                # 2. Check metadata consistency for SVGs
                if is_svg(full_path):
                    if img_type != "image/svg+xml":
                        svg_mismatch_records.append(error_entry)

    print(f"Total Missing Files: {len(missing_records)}")
    print(f"Total Broken Files: {len(broken_records)}")
    print(f"Total SVG Metadata Mismatches: {len(svg_mismatch_records)}")

    with open("missing_favicons.jsonl", "w") as f:
        for rec in missing_records:
            f.write(json.dumps(rec) + "\n")

    with open("broken_favicons.jsonl", "w") as f:
        for rec in broken_records:
            f.write(json.dumps(rec) + "\n")

    with open("svg_mismatches.jsonl", "w") as f:
        for rec in svg_mismatch_records:
            f.write(json.dumps(rec) + "\n")


if __name__ == "__main__":
    audit()
