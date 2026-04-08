import json
import html
import os

def investigate_titles():
    input_path = 'feeds_final.jsonl'
    output_path = 'problematic_titles.jsonl'
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    print(f"Reading {input_path}...")
    
    count = 0
    with open(input_path, 'r') as f, open(output_path, 'w') as out:
        for line in f:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
                
            title = entry.get('title')
            
            is_problematic = False
            
            if title is None or title.strip() == "":
                entry['issue_type'] = "NULL_OR_EMPTY"
                is_problematic = True
            elif title.strip() == "#NAME?":
                entry['issue_type'] = "NAME_ERROR"
                is_problematic = True
            elif title != html.unescape(title):
                entry['issue_type'] = "HTML_ENTITIES"
                is_problematic = True
                
            if is_problematic:
                out.write(json.dumps(entry) + '\n')
                count += 1

    print(f"Found {count} problematic entries. Written to {output_path}")

if __name__ == "__main__":
    investigate_titles()
