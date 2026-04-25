import json
from collections import defaultdict
import sys

def find_duplicates():
    import os
    file_path = os.path.join(os.path.dirname(__file__), 'feeds_deduplicated.jsonl')
    
    print(f"Reading {file_path}...")
    
    entries = []
    try:
        with open(file_path, 'r') as f:
            for line in f:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return

    total_count = len(entries)
    print(f"Total entries: {total_count}")

    # Group by content_hash
    by_hash = defaultdict(list)
    for entry in entries:
        h = entry.get('content_hash')
        if h:
            by_hash[h].append(entry)

    # Group by feed_url
    by_url = defaultdict(list)
    for entry in entries:
        u = entry.get('feed_url')
        if u:
            by_url[u].append(entry)

    # Analyze Hash Duplicates
    hash_dupes = {k: v for k, v in by_hash.items() if len(v) > 1}
    print(f"\n--- Duplicates by content_hash: {len(hash_dupes)} groups ---")
    
    hash_dupe_count = 0
    for h, group in hash_dupes.items():
        hash_dupe_count += len(group) - 1
        print(f"\nHash: {h[:10]}... ({len(group)} entries)")
        # Compare first two to see differences
        diffs = get_differences(group)
        if diffs:
            print("  Differences found in group:")
            for key, vals in diffs.items():
                unique_vals = set(str(v) for v in vals)
                if len(unique_vals) > 1:
                    print(f"    {key}: {list(unique_vals)[:3]}")
        else:
            print("  Entries are identical.")

    # Analyze URL Duplicates
    url_dupes = {k: v for k, v in by_url.items() if len(v) > 1}
    print(f"\n--- Duplicates by feed_url: {len(url_dupes)} groups ---")
    
    url_dupe_count = 0
    for u, group in url_dupes.items():
        url_dupe_count += len(group) - 1
        # We only want to print if it wasn't already covered by hash duplicates (optional, but user asked for both)
        # But often same hash implies same URL (or vice versa).
        # Let's print them but maybe note if hash is also same.
        
        # Check if all have same hash
        hashes = set(e.get('content_hash') for e in group)
        same_hash = len(hashes) == 1
        
        print(f"\nURL: {u} ({len(group)} entries)")
        if same_hash:
            print("  (All have same content_hash)")
        else:
            print(f"  (Different content_hashes: {hashes})")

        diffs = get_differences(group)
        if diffs:
            print("  Differences found in group:")
            for key, vals in diffs.items():
                unique_vals = set(str(v) for v in vals)
                if len(unique_vals) > 1:
                    print(f"    {key}: {list(unique_vals)[:3]}")

    print("\n" + "="*30)
    print(f"Summary:")
    print(f"Total entries: {total_count}")
    print(f"Groups with duplicate content_hash: {len(hash_dupes)} (Redundant entries: {hash_dupe_count})")
    print(f"Groups with duplicate feed_url: {len(url_dupes)} (Redundant entries: {url_dupe_count})")
    print("="*30)

def get_differences(group):
    """Returns a dict of key -> list of values for keys that differ across the group."""
    if not group:
        return {}
    
    keys = set()
    for e in group:
        keys.update(e.keys())
    
    diffs = {}
    for k in keys:
        values = [e.get(k) for e in group]
        # Check if all values are equal
        # We use string representation for simple comparison of dicts/lists
        first = json.dumps(values[0], sort_keys=True)
        is_diff = False
        for v in values[1:]:
            if json.dumps(v, sort_keys=True) != first:
                is_diff = True
                break
        
        if is_diff:
            diffs[k] = values
            
    return diffs

if __name__ == "__main__":
    find_duplicates()
