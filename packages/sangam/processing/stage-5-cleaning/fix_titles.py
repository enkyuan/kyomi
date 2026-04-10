import json
import html
import os
from urllib.parse import urlparse

def generate_title_from_url(url):
    if not url:
        return "Unknown Feed"
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        if domain.startswith('www.'):
            domain = domain[4:]
        
        # Remove TLD if possible for cleaner title
        parts = domain.split('.')
        if len(parts) > 1:
            name = parts[0]
        else:
            name = domain
            
        # Simple formatting: replace hyphens with spaces and title case
        name = name.replace('-', ' ').title()
        return name
    except:
        return "Unknown Feed"

def fix_titles():
    input_path = 'feeds_final.jsonl'
    output_path = 'feeds_fixed.jsonl'
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    print(f"Reading {input_path}...")
    
    fixed_count = 0
    
    with open(input_path, 'r') as f, open(output_path, 'w') as out:
        for line in f:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
                
            title = entry.get('title')
            original_title = title
            modified = False
            
            # Fix HTML entities
            if title and isinstance(title, str):
                unescaped = html.unescape(title)
                if unescaped != title:
                    title = unescaped
                    modified = True
            
            # Fix bad titles
            if title is None or title.strip() == "" or title.strip() == "#NAME?":
                # Try website_url first
                candidate_url = entry.get('website_url')
                
                # Check for generic or missing website_url
                if not candidate_url or "duckduckgo" in candidate_url or "gstatic" in candidate_url:
                    candidate_url = entry.get('feed_url')
                
                new_title = generate_title_from_url(candidate_url)
                
                # If we still have nothing good, maybe look at source file?
                # But generate_title_from_url usually returns something.
                
                title = new_title
                modified = True
            
            if modified:
                entry['title'] = title
                fixed_count += 1
                
            out.write(json.dumps(entry) + '\n')

    print(f"Fixed {fixed_count} titles.")
    print(f"Writing to {output_path}...")
    
    # Overwrite original file
    os.replace(output_path, input_path)
    print(f"Overwrote {input_path} with fixed titles.")

if __name__ == "__main__":
    fix_titles()
