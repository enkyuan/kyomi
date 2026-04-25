import json
import logging
import os
from collections import defaultdict
from final_schema import FinalFeed
from pydantic import ValidationError

# Attempt to import python-magic for MIME type detection
try:
    import magic
except ImportError:
    magic = None

logging.basicConfig(level=logging.INFO, format="%(message)s")

# Allowed literals from the schema
ALLOWED_CATEGORIES = {
    "news_current_events",
    "society_law_history",
    "regional_local",
    "travel_geography",
    "industry_professions",
    "business_finance",
    "software_engineering",
    "consumer_tech_digital",
    "automotive_transport",
    "science_nature",
    "health_wellness",
    "sports",
    "gaming",
    "entertainment",
    "arts_culture",
    "home_hobbies",
    "food_drink",
    "family_relationships",
    "identity_community",
    "style_shopping",
}

ALLOWED_CONTENT_TYPES = {
    "news_outlet",
    "magazine_editorial",
    "indie_blog",
    "corporate_blog",
    "newsletter",
    "aggregator",
    "forum_community",
    "podcast_feed",
    "video_channel",
    "documentation_wiki",
    "status_changelog",
    "marketplace_listings",
    "government_institutional",
    "open_source_activity",
    "education_research",
}


def infer_mime_type(image_path: str) -> str:
    """Return MIME type for a given image file using python-magic.
    Falls back to empty string if detection fails.
    """
    if magic is None:
        return ""
    try:
        # Resolve relative path within favicons directory
        full_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "stage-3-favicon-dedupe",
            "favicons",
            image_path,
        )
        if not os.path.isfile(full_path):
            return ""
        mime = magic.from_file(full_path, mime=True)
        return mime or ""
    except Exception as e:
        logging.error(f"MIME detection error for {image_path}: {e}")
        return ""


def validate_feeds(filepath):
    lines_processed = 0
    valid_count = 0

    # Error counters
    custom_image_errors = 0
    pydantic_error_counts = defaultdict(int)
    category_errors = 0
    content_type_errors = 0

    print(f"Validating {filepath}...")

    with open(filepath, "r") as f:
        for line in f:
            lines_processed += 1
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                pydantic_error_counts["JSON Decode Error"] += 1
                continue

            # --- Image URL / Type handling ---
            image_url = record.get("image_url")
            image_type = record.get("image_type")
            if image_url and not image_type:
                # Attempt to infer MIME type from the stored favicon file
                inferred = infer_mime_type(image_url)
                if inferred:
                    record["image_type"] = inferred
                    image_type = inferred
                else:
                    custom_image_errors += 1
                    logging.error(
                        f"Line {lines_processed}: Image Error - url='{image_url}' missing type and could not infer."
                    )

            # --- Category / Content Type validation ---
            cat = record.get("category")
            if cat and cat not in ALLOWED_CATEGORIES:
                category_errors += 1
                original_cat = cat
                if cat == "art_design":
                    record["category"] = "arts_culture"
                elif cat == "family_parenting":
                    record["category"] = "family_relationships"
                else:
                    # Fallback for any other unexpected categories
                    record["category"] = "news_current_events"

                logging.error(
                    f"Line {lines_processed}: Invalid category '{original_cat}' replaced with '{record['category']}'."
                )

            ct = record.get("content_type")
            if ct and ct not in ALLOWED_CONTENT_TYPES:
                content_type_errors += 1
                original_ct = ct
                if ct == "community_blog":
                    record["content_type"] = "indie_blog"
                else:
                    # Fallback for any other unexpected content types
                    record["content_type"] = "news_outlet"

                logging.error(
                    f"Line {lines_processed}: Invalid content_type '{original_ct}' replaced with '{record['content_type']}'."
                )

            # --- Pydantic validation ---
            try:
                FinalFeed(**record)
            except ValidationError as e:
                for error in e.errors():
                    field = ".".join(str(loc) for loc in error["loc"])
                    msg = error["msg"]
                    error_sig = f"{field}: {msg}"
                    pydantic_error_counts[error_sig] += 1
                # Count as error but continue
                continue
            else:
                valid_count += 1

            if lines_processed % 10000 == 0:
                print(f"Processed {lines_processed} lines...")

    print("\nValidation Completed.")
    print(f"Total Processed: {lines_processed}")
    print(f"Valid Records: {valid_count}")
    print(f"Invalid Records: {lines_processed - valid_count}")

    print("\n--- Custom Logic Failures ---")
    print(f"Image URL w/o Type (unresolved): {custom_image_errors}")

    print("\n--- Pydantic Validation Failures (Top 20) ---")
    sorted_errors = sorted(
        pydantic_error_counts.items(), key=lambda x: x[1], reverse=True
    )
    for err, count in sorted_errors[:20]:
        print(f"{err}: {count}")

    print("\n--- Targeted Field Check ---")
    print(f"Category Errors Fixed: {category_errors}")
    print(f"Content Type Errors Fixed: {content_type_errors}")

    if (lines_processed - valid_count) > 0:
        exit(1)
    else:
        exit(0)


if __name__ == "__main__":
    validate_feeds("feeds.jsonl")
