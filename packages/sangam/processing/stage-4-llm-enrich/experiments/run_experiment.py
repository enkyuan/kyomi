import json
import os
import sys
import asyncio

# Add project root/parent to path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from llm_processor import (
    LLMProcessor,
    EnrichmentResponse,
)

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXPERIMENT_FILE = os.path.join(BASE_DIR, "./evaluation_set.json")
OUTPUT_REPORT = os.path.join(BASE_DIR, "experiment_results.json")
# The prompt is now a single file in the parent directory
ENRICH_PROMPT = os.path.join(BASE_DIR, "../enrich_feed.md")


async def run_experiment():
    print("Loading experiment set...")
    try:
        with open(EXPERIMENT_FILE, "r") as f:
            data = json.load(f)
            records = data.get("experiment_set", [])
    except FileNotFoundError:
        print(
            f"File not found: {EXPERIMENT_FILE}. Please run get_experiment_set.py first."
        )
        return

    if not records:
        print("No records found in experiment set.")
        return

    processor = LLMProcessor()
    results = []
    batch_size = 5

    print(f"Processing {len(records)} records in batches of {batch_size}...")

    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        batch_inputs = [item["record"] for item in batch]

        print(f"Running batch {i//batch_size + 1}...")

        try:
            # Run the single enrichment prompt
            enrichment_out = processor.process_batch(
                ENRICH_PROMPT, batch_inputs, EnrichmentResponse
            )

            # Merge results
            for j, item in enumerate(batch):
                record = batch_inputs[j]
                feed = record.get("feed", {})
                input_url = feed.get("feed_url")

                def find_res(res_list, url):
                    for r in res_list:
                        if hasattr(r, "feed_url") and r.feed_url == url:
                            return r
                    return None

                # Find corresponding result by URL or index fallback
                e_res = (
                    find_res(enrichment_out.results, input_url)
                    or enrichment_out.results[j]
                    if j < len(enrichment_out.results)
                    else None
                )

                results.append(
                    {
                        "meta": {
                            "segment": item["segment"],
                            "description": item["description"],
                            "why_in_set": item["why"],
                        },
                        "input": {
                            "title": feed.get("title"),
                            "url": input_url,
                            "summary": feed.get("summary"),
                            "categories": feed.get("category"),
                        },
                        "output": {
                            "clean_title": e_res.clean_title if e_res else "MISSING",
                            "language_code": (
                                e_res.language_code if e_res else "MISSING"
                            ),
                            "curated_description": (
                                e_res.curated_description if e_res else "MISSING"
                            ),
                            "author": e_res.author if e_res else "MISSING",
                            "popularity_score": e_res.popularity_score if e_res else -1,
                            "category": e_res.category if e_res else "MISSING",
                            "content_type": e_res.content_type if e_res else "MISSING",
                            "tags_en": e_res.tags_en if e_res else [],
                            "tags_native": e_res.tags_native if e_res else [],
                        },
                    }
                )

        except Exception as e:
            print(f"Error processing batch {i}: {e}")
            import traceback

            traceback.print_exc()

    # Save Results
    with open(OUTPUT_REPORT, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"Saved results to {OUTPUT_REPORT}")

    # Print Summary Analysis
    print("\n--- Quick Analysis ---")
    for res in results:
        print(f"\n[{res['meta']['segment']}] {res['input']['title']}")
        print(f"  -> Clean Title: {res['output']['clean_title']}")
        print(f"  -> Desc: {res['output']['curated_description']}")
        print(f"  -> Score: {res['output']['popularity_score']}")
        print(
            f"  -> Cat: {res['output']['category']} | Type: {res['output']['content_type']}"
        )
        print(f"  -> Tags (EN): {res['output']['tags_en']}")
        print(f"  -> Tags (Native): {res['output']['tags_native']}")


if __name__ == "__main__":
    asyncio.run(run_experiment())
