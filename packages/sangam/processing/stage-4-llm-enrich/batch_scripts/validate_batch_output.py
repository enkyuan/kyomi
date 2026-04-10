import sys
import json
import logging
from pathlib import Path

# Add readspace to path to allow importing language_detection
# Script is in processing/stage-4-llm-enrich/batch_scripts/
# We need to go up 4 levels to reach root 'rss-r-us'
# root: /home/kamui/rss-r-us
# this script: /home/kamui/rss-r-us/processing/stage-4-llm-enrich/batch_scripts/validate_batch_output.py
root_path = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(root_path))

from readspace.language_detection import detect_language

# Setup logging
# We will configure file logging in main() based on output filename
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("validator")

# Constants from enrich_feed.md
VALID_CATEGORIES = {
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

VALID_CONTENT_TYPES = {
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


def load_input_urls(input_file):
    """
    Loads feed URLs from the input JSONL file into a set for fast lookup.
    """
    urls = set()
    logger.info(f"Loading input feeds from {input_file}...")
    try:
        with open(input_file, "r") as f:
            for i, line in enumerate(f):
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    # Input structure: {"feed": {"feed_url": "...", ...}, ...}
                    # Handle both structures if input format varies, but based on view_file:
                    url = None
                    if "feed" in data and isinstance(data["feed"], dict):
                        url = data["feed"].get("feed_url")
                    elif "feed_url" in data:
                        # Fallback if flat
                        url = data.get("feed_url")

                    if url:
                        urls.add(url)
                except json.JSONDecodeError:
                    pass
                if i % 50000 == 0 and i > 0:
                    logger.info(f"Scanned {i} input lines...")
    except FileNotFoundError:
        logger.error(f"Input file not found: {input_file}")
        sys.exit(1)

    logger.info(f"Loaded {len(urls)} unique feed URLs from input.")
    return urls


def validate_row(row, input_urls, row_idx):
    errors = []
    warnings = []

    feed_url = row.get("feed_url")

    # Check 1: feed_url matches input
    if not feed_url:
        errors.append("Missing feed_url")

    # Check 1.5: clean_title
    clean_title = row.get("clean_title")
    if not clean_title or not clean_title.strip():
        errors.append("Missing or empty clean_title")
    elif len(clean_title) > 200:
        errors.append(f"clean_title is too long ({len(clean_title)} chars)")

    # Check 2: language_detection on description vs language_code
    lang_code = row.get("language_code")
    curated_desc = row.get("curated_description")

    if not lang_code:
        errors.append("Missing language_code")
    if not curated_desc:
        errors.append("Missing curated_description")

    if lang_code and curated_desc:
        # Detect language of the output description
        # detect_language returns 2-letter ISO code or None
        detected = detect_language(curated_desc)

        if detected:
            is_mismatch = True
            if detected == lang_code:
                is_mismatch = False
            else:
                # Define groups of languages that are often confused or valid substitutes
                # 1. Norwegian variants (no, nb, nn)
                # 2. Indonesian / Malay (id, ms)
                # 3. Serbo-Croatian (sr, hr)
                # 4. Devanagari script languages + Urdu (hi, ur, ne, mr)
                valid_groups = [
                    {"no", "nb", "nn"},
                    {"id", "ms"},
                    {"sr", "hr"},
                    {"hi", "ur", "ne", "mr"},
                ]

                for group in valid_groups:
                    if lang_code in group and detected in group:
                        is_mismatch = False
                        break

            if is_mismatch:
                # If LLM says 'en' but writes in 'fr', it's an error.
                errors.append(
                    f"Language mismatch in description: Declared '{lang_code}' vs Detected '{detected}'. Content: '{curated_desc[:50]}...'"
                    + " for title: "
                    + clean_title
                )
        else:
            warnings.append(
                f"Could not detect language of description. Content length: {len(curated_desc)}. Content: '{curated_desc[:100]}...'"
            )

    # Check 3: Enums
    category = row.get("category")
    content_type = row.get("content_type")

    if category and category not in VALID_CATEGORIES:
        errors.append(f"Invalid category: '{category}'")
    elif not category:
        errors.append("Missing category")

    if content_type and content_type not in VALID_CONTENT_TYPES:
        errors.append(f"Invalid content_type: '{content_type}'")
    elif not content_type:
        errors.append("Missing content_type")

    # Check 4: Popularity Score
    pop_score = row.get("popularity_score")
    if pop_score is None:
        errors.append("Missing popularity_score")
    elif not isinstance(pop_score, (int, float)):
        errors.append(f"Invalid popularity_score type: {type(pop_score)}")
    elif not (0 <= pop_score <= 100):
        errors.append(f"popularity_score {pop_score} out of range (0-100)")

    # Check 5: Tags
    tags_en = row.get("tags_en")
    tags_native = row.get("tags_native")

    if tags_en is None:
        errors.append("Missing tags_en")
    elif not isinstance(tags_en, list):
        errors.append("tags_en must be a list")
    else:
        if len(tags_en) == 0:
            errors.append("tags_en is empty")
        elif len(tags_en) < 3:
            warnings.append(f"tags_en count produces {len(tags_en)}, expected >= 3")

    if tags_native is None:
        errors.append("Missing tags_native")
    elif not isinstance(tags_native, list):
        errors.append("tags_native must be a list")
    else:
        if lang_code == "en" and len(tags_native) > 0:
            errors.append(
                f"tags_native should be empty for language_code 'en', found {len(tags_native)} tags"
            )

    return errors, warnings


def main():
    if len(sys.argv) < 3:
        print("Usage: python validate_batch_output.py <input_jsonl> <output_jsonl>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    # Configure error logging to file
    error_log_file = f"{output_file}.errors.log"
    file_handler = logging.FileHandler(error_log_file, mode="w")
    file_handler.setLevel(logging.WARNING)  # capture warnings and errors
    file_handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    logger.addHandler(file_handler)

    # Also keep console clean - maybe remove default handler if it's too noisy?
    # For now, we assume basicConfig set up console for INFO+

    input_urls = load_input_urls(input_file)

    logger.info(f"Validating output file: {output_file}")
    logger.info(f"Errors and warnings will be logged to: {error_log_file}")

    total_rows = 0
    passed_rows = 0

    failed_rows = 0
    seen_urls = set()
    failed_validation_urls = set()

    try:
        with open(output_file, "r") as f:
            for i, line in enumerate(f):
                if not line.strip():
                    continue
                total_rows += 1
                try:
                    row = json.loads(line)
                    # Track seen URL
                    if "feed_url" in row:
                        seen_urls.add(row["feed_url"])

                    errors, warnings = validate_row(row, input_urls, i + 1)

                    if errors:
                        failed_rows += 1
                        if "feed_url" in row:
                            failed_validation_urls.add(row["feed_url"])
                        logger.error(f"Row {i+1} FAIL: {errors}")
                    else:
                        passed_rows += 1

                    if warnings:
                        logger.warning(f"Row {i+1} WARN: {warnings}")

                except json.JSONDecodeError:
                    logger.error(f"Row {i+1} FAIL: Invalid JSON")
                    failed_rows += 1
    except FileNotFoundError:
        logger.error(f"Output file not found: {output_file}")
        sys.exit(1)

    print("-" * 30)
    print(f"Validation Complete.")
    print(f"Total Output Rows: {total_rows}")
    print(f"Rows Passed: {passed_rows}")
    print(f"Rows Failed: {failed_rows}")

    print(f"Failed Validation Feeds: {len(failed_validation_urls)}")
    print(f"Error Log: {error_log_file}")
    print("-" * 30)

    if failed_rows > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
