import json
import sys
from collections import defaultdict
from datetime import datetime
import re
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

# Configuration
INPUT_FILE = "feeds_restored.jsonl"
OUTPUT_FILE = "feeds_restored_deduped.jsonl"
REPORT_MD = "deduplication_audit.md"


def get_timestamp_now():
    return datetime.now().timestamp()


def is_feedburner(url):
    if not url:
        return False
    return "feedburner" in url.lower()


def get_stats_tuple(record):
    """Returns (last_post_date, posts_per_week, median_interval)"""
    stats = record.get("stats") or {}
    lp = stats.get("last_post_date") or 0
    ppw = stats.get("posts_per_week") or 0
    interval = stats.get("median_post_interval") or 0

    # Normalize lp to float
    try:
        lp = float(lp)
    except:
        lp = 0.0

    return lp, ppw, interval


def are_stats_roughly_same(rec1, rec2):
    """
    Check if stats are roughly similar (within 10% for PPW).
    Used for query param dedupe logic.
    """
    _, ppw1, _ = get_stats_tuple(rec1)
    _, ppw2, _ = get_stats_tuple(rec2)

    # Handle zero case
    if ppw1 == 0 and ppw2 == 0:
        return True

    max_ppw = max(ppw1, ppw2)
    diff = abs(ppw1 - ppw2)

    if max_ppw == 0:
        return True  # Should be covered above

    # If difference is small relative to magnitude
    pct_diff = diff / max_ppw
    return pct_diff < 0.10


def is_path_variant(url1, url2):
    """
    Check if one URL is a path variant of the other (e.g. /feed vs /blog/feed).
    Ignores protocol and www.
    """

    def clean(u):
        u = re.sub(r"^https?://(www\.)?", "", u.lower())
        return u.split("?")[0].rstrip("/")

    c1 = clean(url1)
    c2 = clean(url2)

    # Check if they share the same domain/base
    # Simple heuristic: if one string is contained in the other
    # and difference is just 'blog' or 'feed' segments.
    # Actually, user example: /feed/ vs /blog/feed/

    if c1 == c2:
        return True

    # If one is a substring of the other
    if c1 in c2 or c2 in c1:
        return True

    return False


def is_query_variant(url1, url2):
    """
    Check if URLs are identical except for query parameters.
    """

    def clean_base(u):
        p = urlparse(u)
        # Reconstruct without query
        return p.netloc + p.path

    return clean_base(url1) == clean_base(url2)


def process_group(records):
    """
    Process a group of records (Same Title + Same Website).
    """
    if not records:
        return [], []

    # 1. Handling Zero Posts/Week (Dead Feeds)
    # Rule: "only drop zero posts / week in event of duplicates" (i.e. if a better 'alive' option exists)

    # If standard singleton, just keep it (even if 0 PPW)
    if len(records) == 1:
        return records, []

    # If we have duplicates, check if we can filter out dead ones
    active_records = []
    dead_records = []

    for r in records:
        lp, ppw, _ = get_stats_tuple(r)
        if ppw == 0:
            dead_records.append(r)
        else:
            active_records.append(r)

    dropped = []

    # CASE A: Mixed Active and Dead
    # We have some active feeds. We can safely drop the dead ones.
    if active_records:
        for r in dead_records:
            dropped.append((r, "Zero Posts/Week (Duplicate of Active Feed)"))
        # Continue with only active records
        candidates = active_records
    else:
        # CASE B: All Dead
        # We have duplicates, but ALL are 0 PPW.
        # We must keep one. We treat them all as candidates.
        candidates = dead_records

    # Now proceeding with `candidates` to find the best one among them.
    # (The following logic needs to handle `candidates` instead of `active_records`)

    sorted_by_date = sorted(
        candidates, key=lambda x: get_stats_tuple(x)[0], reverse=True
    )
    best_date = get_stats_tuple(sorted_by_date[0])[0]

    # 2. STALE CHECK (> 1 year older than best)
    # Only applies if we have a valid 'best' to compare against.
    # Comparison should be within the candidates group.

    fresh_candidates = []

    for r in sorted_by_date:
        lp, _, _ = get_stats_tuple(r)

        # If the gap is massive (> 1 year) and we have a fresher alternative (best_date)
        # Note: if all are old, best_date is also old, so diff is 0.
        # This safely handles "All Stale" case by keeping the "least stale" one.

        if (best_date - lp) > (365 * 24 * 3600):
            dropped.append((r, "Stale (>1 year older than best)"))
        else:
            fresh_candidates.append(r)

    if not fresh_candidates:
        fresh_candidates = sorted_by_date  # Fallback

    active_candidates = fresh_candidates

    # 3. SPECIAL COMPARISONS
    # We now pick the winner from fresh_candidates.
    # To do this effectively with >2 candidates is tricky, but usually these are pairs.
    # We will score them.

    def score_candidate(cand):
        url = cand.get("feed_url", "")
        lp, ppw, _ = get_stats_tuple(cand)
        is_fb = is_feedburner(url)
        is_https = url.startswith("https://")

        score = 0

        # Base Points for Recency (Normalized roughly to days?)
        # Let's just use ranking sort logic instead of arbitrary points if possible.
        # But we need conditional logic.
        return 0

    # Let's stick to pairwise elimination for the final set?
    # Or just a robust sort key that embodies the rules.

    # Rules recap:
    # - Non-Feedburner > Feedburner (UNLESS Non-FB is stale/dead compared to FB).
    #   (We already handled Stale logic above. So if both are Fresh, prefer Non-FB).
    # - Path/Query variants:
    #   - If roughly same stats: Pick Recency.
    #   - If diff stats (PPW): Pick Higher PPW (implies logic for BreakingNews).

    # Let's do a hierarchical sort:

    def heuristic_sort(r):
        url = r.get("feed_url", "")
        lp, ppw, _ = get_stats_tuple(r)

        # 1. Is Non-Feedburner? (Primary Preference if both fresh)
        # Note: True > False.
        not_feedburner = not is_feedburner(url)

        # 2. HTTPS?
        is_https = url.startswith("https://")

        # 3. Richness (PPW).
        # But wait, user said "pick most recent" for Path/Query variants with SAME stats.
        # But "not in this case" where PPW is diff.
        # This implies: If PPW diff is large -> Follow PPW.
        # If PPW diff is small -> Follow Recency.

        # This conditional dependency makes a simple key hard.
        # However, we can group logic:
        return (not_feedburner, is_https, ppw, lp)

    # Since we can't easily do a conditional sort key for everyone simultaneously without complex tuples,
    # let's try to find the "Winner" by iterating.

    # Default Winner: Best Recency
    active_candidates.sort(key=lambda x: get_stats_tuple(x)[0], reverse=True)
    winner = active_candidates[0]

    # Now check if we should dethrone the Recency Winner?
    # Candidate Set is usually small (2-3).

    # Let's iterate and compare "Winner" against "Challenger"
    # Logic: Start with best Recency. Check if others are "Better" based on other rules.

    # Better approach might be: Filter based on rules first.

    # Rule: Feedburner demotion.
    # Identify Non-FB candidates.
    non_fb = [x for x in active_candidates if not is_feedburner(x["feed_url"])]
    if non_fb:
        # We have Non-FB candidates.
        # Unless the FB candidate is "Way Ahead" (Recency), we prefer the best Non-FB.
        # We already filtered "Stale" (>1 year gap). So they are within 1 year.
        # Check if FB is significantly ahead (e.g. > 1 month?)
        # User: "sometimes non-feedburner is way ahead... if feedburner goes down we'd be done."
        # This implies strong preference for Non-FB unless it's clearly broken/abandoned.
        # Since we filtered "Stale", valid Non-FB should win.

        # Filter active_candidates to ONLY Non-FB?
        # Only if the Non-FB is not "terrible" compared to FB.
        # Let's check stats of best Non-FB vs best FB.
        fb = [x for x in active_candidates if is_feedburner(x["feed_url"])]
        if fb:
            best_non_fb = max(non_fb, key=lambda x: get_stats_tuple(x)[0])
            best_fb = max(fb, key=lambda x: get_stats_tuple(x)[0])

            lp_non, _, _ = get_stats_tuple(best_non_fb)
            lp_fb, _, _ = get_stats_tuple(best_fb)

            # If FB is > 30 days newer than Non-FB, maybe keep FB?
            # User example CX Journey: Non-FB was 2025, FB was 2019.
            # Reverse case: If FB is 2025 and Non-FB is 2024?
            # User: "prefer feedburner over original... but if feedburner goes down..."
            # actually user revised to: "do you think we should gennerally prefer feedburner...?"
            # and then "if non-feedburner is way ahead... obv pick non feed burner".

            # Safe bet: Prefer Non-FB unless it is significantly worse (older).
            # If Non-FB is within ~90 days of FB, pick Non-FB.
            if (lp_fb - lp_non) < (90 * 24 * 3600):
                # Apply preference: Drop FB candidates
                dropped.extend([(r, "Feedburner (Prefer Original)") for r in fb])
                active_candidates = non_fb

    # If we reduced to 1, done.
    if len(active_candidates) == 1:
        return [active_candidates[0]], dropped

    # Rule: Path/Query Variants & Stats
    # Sort remaining by Recency first (default tie breaker)
    active_candidates.sort(key=lambda x: get_stats_tuple(x)[0], reverse=True)
    best_candidate = active_candidates[0]

    # Now check rule: "If stats roughly same -> Pick Most Recent" (which is best_candidate).
    # "If stats NOT roughly same -> Pick Higher PPW".

    # Let's look for a Challenger with much better PPW.
    lp_best, ppw_best, _ = get_stats_tuple(best_candidate)

    final_winner = best_candidate

    for challenger in active_candidates[1:]:
        lp_chal, ppw_chal, _ = get_stats_tuple(challenger)

        # Is Challenger "Much Richer"?
        # e.g. PPW is 2x or more? Or diff > 5?
        # User BreakingNews: 206 vs 64. (3x).
        # User said "posts/week is too diff" to rely on recency.
        if ppw_chal > (ppw_best * 1.5) and ppw_chal > 5:
            # Challenger is significantly more active.
            # Switch winner?
            # Wait, verify Challenger isn't ancient. (We already filtered Stale).
            # If Challenger is within 1 year and 2x activity, they win.
            final_winner = challenger
            ppw_best = ppw_chal  # New baseline

    # Mark losers
    losers = []
    active_set = set(id(x) for x in active_candidates)  # Use ID since dicts unhashable

    # Re-collect from original group to ensure we catch everyone
    # Actually just iterate active_candidates
    for c in active_candidates:
        if c is not final_winner:
            # Check why
            if is_query_variant(c["feed_url"], final_winner["feed_url"]):
                dropped.append((c, "Query Variant (Suboptimal)"))
            elif is_path_variant(c["feed_url"], final_winner["feed_url"]):
                dropped.append((c, "Path Variant (Suboptimal)"))
            else:
                dropped.append((c, "Duplicate (Suboptimal Stats/Recency)"))

    return [final_winner], dropped


def main():
    print(f"Loading {INPUT_FILE}...")
    grouped = defaultdict(list)
    total_in = 0

    try:
        with open(INPUT_FILE, "r") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    rec = json.loads(line)
                    t = rec.get("title")
                    w = rec.get("website_url")

                    if not t:
                        continue

                    t = t.strip()
                    w = w.strip() if w else ""

                    key = (t, w)
                    grouped[key].append(rec)
                    total_in += 1
                except:
                    pass
    except FileNotFoundError:
        print(f"Input file {INPUT_FILE} not found.")
        sys.exit(1)

    print(f"Total Records Loaded: {total_in}")
    print(f"Unique Groups: {len(grouped)}")

    final_records = []
    total_dropped = 0
    audit_log = []

    for key, group in grouped.items():
        kept, dropped_info = process_group(group)
        final_records.extend(kept)

        if dropped_info:
            total_dropped += len(dropped_info)
            audit_log.append(
                {"group_title": key[0], "group_site": key[1], "dropped": dropped_info}
            )

    print("Deduplication complete.")
    print(f"Records Kept: {len(final_records)}")
    print(f"Records Dropped: {total_dropped}")

    # Write Output
    with open(OUTPUT_FILE, "w") as f:
        for r in final_records:
            f.write(json.dumps(r) + "\n")

    # Write Audit Report
    with open(REPORT_MD, "w") as f:
        f.write("# Deduplication Audit Log\n\n")
        f.write(f"Total Records Processed: {total_in}\n")
        f.write(f"Total Dropped: {total_dropped}\n")
        f.write(f"Final Count: {len(final_records)}\n\n")
        f.write("---\n\n")

        for log in audit_log:
            title = log["group_title"]
            site = log["group_site"]
            f.write(f"### {title} ({site})\n")
            for item, reason in log["dropped"]:
                url = item.get("feed_url")
                stats = item.get("stats") or {}
                lp = stats.get("last_post_date")
                ppw = stats.get("posts_per_week")

                f.write(f"- **Dropped**: `{url}`\n")
                f.write(f"  - Reason: {reason}\n")
                f.write(f"  - Last Post: {lp}, PPW: {ppw}\n")
            f.write("\n")

    print(f"Output written to {OUTPUT_FILE}")
    print(f"Audit log written to {REPORT_MD}")


if __name__ == "__main__":
    main()
