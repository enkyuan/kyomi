#!/usr/bin/env python3

import argparse
import json
import math
from pathlib import Path
from typing import Any


def pick_str(record: dict[str, Any], keys: list[str]) -> str | None:
    for key in keys:
        value = record.get(key)
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed:
                return trimmed
    return None


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def pick_float(record: dict[str, Any], keys: list[str]) -> float | None:
    for key in keys:
        value = record.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            candidate = float(value)
        elif isinstance(value, str):
            trimmed = value.strip()
            if not trimmed:
                continue
            try:
                candidate = float(trimmed)
            except ValueError:
                continue
        else:
            continue
        # Skip non-finite values (NaN/inf): json.dumps would emit bare NaN/Infinity
        # tokens that the TS importer's JSON.parse rejects, dropping the whole record.
        if math.isfinite(candidate):
            return candidate
    return None


def normalize_source_record(record: dict[str, Any], source: str) -> dict[str, Any] | None:
    feed_url = pick_str(record, ["feed_url", "xmlUrl", "url"])
    if not feed_url:
        return None

    title = pick_str(record, ["cleaned_title", "title", "text"]) or feed_url
    description = pick_str(record, ["summary", "description", "curated_description"]) or ""
    link = pick_str(record, ["website_url", "htmlUrl", "link"]) or ""
    language = pick_str(record, ["language"]) or ""
    category = pick_str(record, ["category", "top_level_category"]) or ""
    content_type = pick_str(record, ["content_type", "contentType"]) or ""
    quality_score = pick_float(record, ["quality_score", "qualityScore", "popularity_score"])

    return {
        "feed_url": feed_url,
        "title": title,
        "description": description,
        "link": link,
        "source": source,
        "language": language,
        "category": category,
        "content_type": content_type,
        "quality_score": quality_score,
    }


def iter_records(inputs_dir: Path):
    feeeed_dir = inputs_dir / "feeeed"
    for path in sorted(feeeed_dir.glob("*.json")):
        data = load_json(path)
        if isinstance(data, list):
            for row in data:
                if isinstance(row, dict):
                    normalized = normalize_source_record(row, "feeeed")
                    if normalized:
                        yield normalized

    feedspot_dir = inputs_dir / "feedspot"
    for path in sorted(feedspot_dir.glob("*.json")):
        data = load_json(path)
        if isinstance(data, dict):
            feeds = data.get("feeds")
            if isinstance(feeds, list):
                for row in feeds:
                    if isinstance(row, dict):
                        normalized = normalize_source_record(row, "feedspot")
                        if normalized:
                            yield normalized


def export_catalog(project_root: Path, output_path: Path, limit: int | None) -> int:
    inputs_dir = project_root / "inputs"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    seen: set[str] = set()
    count = 0
    with output_path.open("w", encoding="utf-8") as handle:
        for record in iter_records(inputs_dir):
            key = record["feed_url"].strip().lower()
            if key in seen:
                continue
            seen.add(key)
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
            if limit is not None and count >= limit:
                break

    return count


def main() -> int:
    parser = argparse.ArgumentParser(description="Export RSS catalog feeds for kyomi import")
    parser.add_argument(
        "--output",
        required=True,
        help="Path to output JSONL file (relative to repo root or absolute)",
    )
    parser.add_argument("--limit", type=int, default=None, help="Optional max feed count")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]
    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = (project_root / output_path).resolve()

    written = export_catalog(project_root, output_path, args.limit)
    print(f"[catalog-export] wrote {written} feeds to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
