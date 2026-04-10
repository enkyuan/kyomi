#!/usr/bin/env python3
import argparse
import logging
import sys
import os

# Ensure project root is in path for readspace import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from pipeline import Pipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("stage3.log")],
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Stage 3: Favicon Dedupe (Single Pass)"
    )
    parser.add_argument(
        "--input",
        default="../stage-2-fetching/enriched_feeds.jsonl",
        help="Input JSONL file",
    )
    parser.add_argument(
        "--output", default="stage_3_feeds.jsonl", help="Output JSONL file"
    )
    parser.add_argument(
        "--favicons-dir", default="favicons", help="Directory to save favicons"
    )
    parser.add_argument(
        "--workers", type=int, default=50, help="Number of concurrent favicon fetchers"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of processed feeds (for testing)",
    )

    args = parser.parse_args()

    logger.info("=== Starting Stage 3 Pipeline (Single Pass) ===")
    logger.info(f"Configuration: Input={args.input}, Workers={args.workers}")

    try:
        pipeline = Pipeline(
            input_path=args.input,
            output_path=args.output,
            favicons_dir=args.favicons_dir,
            workers=args.workers,
            limit=args.limit,
        )
        pipeline.run()

    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
