import json
import argparse
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(
        description="Merge multiple JSONL output files. Files are processed in alphabetical order, so later files override earlier ones."
    )
    parser.add_argument(
        "--input-dir",
        default="output",
        help="Directory containing numbered JSONL files",
    )
    parser.add_argument(
        "--output",
        default="enriched_feeds_merged.jsonl",
        help="Final merged output file",
    )

    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_file = Path(args.output)

    if not input_dir.exists():
        print(f"Error: Input directory '{input_dir}' does not exist.")
        sys.exit(1)

    # valid extensions
    files = sorted([p for p in input_dir.iterdir() if p.suffix == ".jsonl"])

    if not files:
        print(f"No .jsonl files found in '{input_dir}'")
        sys.exit(1)

    print(f"Found {len(files)} files to merge (in order):")
    for f in files:
        print(f" - {f.name}")

    merged_data = {}
    total_lines_read = 0

    for file_path in files:
        print(f"Processing {file_path.name}...")
        count = 0
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        row = json.loads(line)

                        # Determine Key: feed_url
                        # Logic based on validate_batch_output.py
                        url = row.get("feed_url")

                        if not url and "feed" in row and isinstance(row["feed"], dict):
                            url = row["feed"].get("feed_url")

                        if url:
                            merged_data[url] = row
                            count += 1
                        else:
                            # If no URL, we can't key it. Log warning?
                            # For robustness, maybe we should warn.
                            pass

                    except json.JSONDecodeError:
                        print(
                            f"  [WARN] Invalid JSON in {file_path.name} line {line_num}"
                        )

            print(f"  -> Imported {count} records.")
            total_lines_read += count

        except Exception as e:
            print(f"  [ERROR] Failed to read {file_path.name}: {e}")

    print("-" * 30)
    print(f"Total records read: {total_lines_read}")
    print(f"Unique feeds after merge: {len(merged_data)}")

    # Write output
    print(f"Writing merged data to {output_file}...")
    try:
        with open(output_file, "w", encoding="utf-8") as f_out:
            for url in sorted(merged_data.keys()):
                f_out.write(json.dumps(merged_data[url], ensure_ascii=False) + "\n")
        print("Success.")
    except Exception as e:
        print(f"Error writing output file: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
