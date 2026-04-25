import json
import random
from collections import defaultdict
import os

def fix_duplicates():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(base_dir, 'feeds_final.jsonl')
    output_path = os.path.join(base_dir, 'feeds_deduplicated.jsonl')
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    print(f"Reading {input_path}...")
    entries = []
    with open(input_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    
    print(f"Total entries read: {len(entries)}")
    
    # Group by feed_url
    by_url = defaultdict(list)
    entries_without_url = []
    
    for entry in entries:
        u = entry.get('feed_url')
        if u:
            by_url[u].append(entry)
        else:
            entries_without_url.append(entry)

    final_entries = []
    final_entries.extend(entries_without_url)
    
    duplicates_resolved = 0
    
    # Heuristics priority
    # 0: feedspot
    # 1: opml
    # 2: feeeed
    # 3: others
    
    def get_priority(entry):
        ds = entry.get('source_dataset')
        if not ds:
            return 3
        ds = str(ds).lower()
        if 'feedspot' in ds:
            return 0
        if 'opml' in ds:
            return 1
        if 'feeeed' in ds:
            return 2
        return 3

    for url, group in by_url.items():
        if len(group) == 1:
            final_entries.append(group[0])
        else:
            duplicates_resolved += 1
            # Sort by priority
            group.sort(key=get_priority)
            
            # Identify best priority found in this group
            best_priority = get_priority(group[0])
            
            # Collect all candidates with the best priority
            candidates = [e for e in group if get_priority(e) == best_priority]
            
            # Pick one at random
            chosen = random.choice(candidates)
            final_entries.append(chosen)
            
    print(f"Resolved {duplicates_resolved} duplicate groups.")
    print(f"Writing {len(final_entries)} entries to {output_path}...")
    
    with open(output_path, 'w') as f:
        for entry in final_entries:
            f.write(json.dumps(entry) + '\n')
            
    print("Done.")

if __name__ == "__main__":
    fix_duplicates()
