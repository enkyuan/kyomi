import json
import os
import sys
from typing import List, Literal, Optional, Dict, Any
from collections import defaultdict
from pydantic import BaseModel, Field

# Add the stage-4 directory to python path to import LLMProcessor
STAGE_4_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../stage-4-llm-enrich")
)
sys.path.append(STAGE_4_DIR)
from llm_processor import LLMProcessor
from dotenv import load_dotenv

# Load env from stage 4
load_dotenv(os.path.join(STAGE_4_DIR, ".env"))

# --- Configuration ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(SCRIPT_DIR, "feeds.jsonl")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "curated_feeds.md")
PROMPT_SCORE = os.path.join(SCRIPT_DIR, "prompts/popularity_score.md")
PROMPT_CURATE = os.path.join(SCRIPT_DIR, "prompts/curate_best_of.md")

# Number of candidates to consider per category (saving tokens)
CANDIDATE_LIMIT_PER_CATEGORY = 50

# Number of feeds to select for the final curated list
FINAL_DISPLAY_LIMIT = 20

# --- Pydantic Models for LLM Responses ---


class FeedScore(BaseModel):
    feed_url: str
    popularity_score: int = Field(..., description="0-100 Score")
    reason: str = Field(..., description="Short explanation")


class ScoreBatchResponse(BaseModel):
    results: List[FeedScore]


class CuratedFeed(BaseModel):
    feed_url: str
    rank: int
    display_title: str
    curation_reason: str


class CurationResponse(BaseModel):
    selected_feeds: List[CuratedFeed]


# --- Main Logic ---


def load_feeds(filepath):
    """Loads feeds into a dict keyed by feed_url and a dict grouped by category."""
    feeds_by_url = {}
    feeds_by_cat = defaultdict(list)

    print(f"Loading {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            try:
                feed = json.loads(line)
                url = feed.get("feed_url")
                if not url:
                    continue

                # Filter for English for this experiment as prompts are EN focused
                if feed.get("language") != "en":
                    continue

                cat = feed.get("category", "Uncategorized")

                feeds_by_url[url] = feed
                feeds_by_cat[cat].append(feed)
            except:
                continue

    return feeds_by_url, feeds_by_cat


def get_candidates(feeds_list, limit=50):
    """
    Selects the best candidates to send to the LLM based on current metrics.
    """

    # Sort by existing score (desc), then followers (desc)
    def sort_key(f):
        # prioritizing items that already have high score or high followers
        score = f.get("popularity_score", 0) or 0
        followers = f.get("followers", {})
        count = 0
        if isinstance(followers, dict):
            count = sum(followers.values()) if followers else 0
        elif isinstance(followers, int):
            count = followers
        return (score, count)

    sorted_feeds = sorted(feeds_list, key=sort_key, reverse=True)
    return sorted_feeds[:limit]


def batch_process_scores(processor: LLMProcessor, feeds: List[dict]):
    """
    Sends batches of feeds to LLM for Scoring.
    """
    batch_size = 20
    updates = {}

    # Prepare minimal payload
    clean_feeds = []
    for f in feeds:
        clean_feeds.append(
            {
                "feed_url": f.get("feed_url"),
                "title": f.get("title"),
                "description": (f.get("description") or f.get("summary") or "")[:300],
                "category": f.get("category"),
                "website_url": f.get("website_url"),
                "tags": f.get("tags", [])[:5],
            }
        )

    total = len(clean_feeds)
    print(f"  Rescoring {total} feeds...")

    for i in range(0, total, batch_size):
        batch = clean_feeds[i : i + batch_size]
        # print(f"    Batch {i}...")

        try:
            # We pass the list of feeds directly.
            # The prompt expects "Input: [ ... ]" which LLMProcessor handles by dumping the list.
            response = processor.process_batch(PROMPT_SCORE, batch, ScoreBatchResponse)

            for res in response.results:
                updates[res.feed_url] = {
                    "new_score": res.popularity_score,
                    "score_reason": res.reason,
                }
        except Exception as e:
            print(f"    ERROR in batch {i}: {e}")

    return updates


def run_curation(processor: LLMProcessor, category: str, feeds: List[dict]):
    """
    Sends the top rescored feeds to LLM to pick the winner list.
    """
    # Sort by NEW score
    feeds.sort(key=lambda x: x.get("new_score", 0), reverse=True)

    # Take top candidates for curation
    candidates = feeds[:50]

    # Payload
    payload_candidates = []
    for f_idx, f in enumerate(candidates):
        payload_candidates.append(
            {
                "feed_url": f.get("feed_url"),
                "title": f.get("title"),
                "score": f.get("new_score"),
                "score_reason": f.get("score_reason"),
                "domain": f.get("website_url"),
            }
        )

    print(f"  Curating {len(payload_candidates)} candidates for {category}...")

    # Structure matching the prompt's expected input
    input_obj = {
        "CONTEXT": {"TARGET_CATEGORY": category, "LIMIT": FINAL_DISPLAY_LIMIT},
        "CANDIDATES": payload_candidates,
    }

    try:
        # Pass as a list containing one object, or just the object if process_batch handles it.
        # process_batch does `json.dumps(records)`
        response = processor.process_batch(PROMPT_CURATE, [input_obj], CurationResponse)
        return response.selected_feeds
    except Exception as e:
        print(f"    ERROR curating: {e}")
        return []


def main():
    if not os.environ.get("GOOGLE_API_KEY"):
        print("Error: GOOGLE_API_KEY not found.")
        return

    processor = LLMProcessor()

    all_feeds_map, feeds_by_cat = load_feeds(INPUT_FILE)

    # Sort categories to be deterministic
    # sorted_cats = sorted(feeds_by_cat.keys())
    sorted_cats = [
        "consumer_tech_digital",
        "software_engineering",
        "gaming",
    ]  # Experimental subset

    with open(OUTPUT_FILE, "w") as md_out:
        md_out.write("# Experimental Curated Feeds\n\n")

        for cat in sorted_cats:
            print(f"\n=== {cat} ===")

            # 1. Select Candidates
            candidates = get_candidates(feeds_by_cat[cat], CANDIDATE_LIMIT_PER_CATEGORY)
            if not candidates:
                continue

            # 2. Rescore
            full_candidates = []  # Copy so we don't mutate original endlessly if re-run
            for c in candidates:
                full_candidates.append(c.copy())

            updates = batch_process_scores(processor, full_candidates)

            # Apply updates
            files_rescored = []
            for f in full_candidates:
                if f["feed_url"] in updates:
                    f.update(updates[f["feed_url"]])
                    files_rescored.append(f)

            # 3. Curate
            if files_rescored:
                selected = run_curation(processor, cat, files_rescored)

                md_out.write(f"## {cat}\n\n")
                md_out.write("| Rank | New Score | Title | URL | Reason |\n")
                md_out.write("|---|---|---|---|---|\n")

                for item in selected:
                    url = item.feed_url
                    # try to find original url
                    orig = all_feeds_map.get(url)
                    web_url = orig.get("website_url", url) if orig else url

                    # Link title to url
                    md_out.write(
                        f"| {item.rank} | ? | [{item.display_title}]({web_url}) | {web_url} | {item.curation_reason} |\n"
                    )

                md_out.write("\n")
                md_out.flush()
            else:
                print("  No feeds rescored successfully.")

    print(f"\nDone. Results saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
