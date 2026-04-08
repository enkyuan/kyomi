import requests
from bs4 import BeautifulSoup
import json
import sys

import urllib.parse

def normalize_count(count_str):
    if not count_str:
        return 0
    
    count_str = count_str.strip().upper().replace(',', '')
    
    multiplier = 1
    if count_str.endswith('K'):
        multiplier = 1000
        count_str = count_str[:-1]
    elif count_str.endswith('M'):
        multiplier = 1000000
        count_str = count_str[:-1]
    elif count_str.endswith('B'):
        multiplier = 1000000000
        count_str = count_str[:-1]
        
    try:
        return int(float(count_str) * multiplier)
    except ValueError:
        return 0

def scrape_feedspot(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    html_content = response.text

    soup = BeautifulSoup(html_content, 'lxml')
    
    feeds = []
    
    # The main container for the list seems to be div with id 'fsb'
    fsb = soup.find('div', id='fsb')
    if not fsb:
        print("Could not find the main container (div#fsb)", file=sys.stderr)
        return [], ""

    # Extract category
    category = ""
    h2_title = soup.find('h2', id='rssfsbhead')
    if h2_title:
        category = h2_title.get_text(strip=True).removesuffix(" RSS Feeds")

    # Each feed seems to be represented by an h3 (title) and a following p (details)
    # We can iterate through h3 elements with class 'feed_heading'
    feed_headings = fsb.find_all('h3', class_='feed_heading')
    
    for heading in feed_headings:
        feed_data = {}
        
        # Title
        title_tag = heading.find('a', class_='tlink')
        if title_tag:
            feed_data['title'] = title_tag.get_text(strip=True).removesuffix(" RSS Feed")
        
        # The details are in the next sibling 'p' tag with class 'trow'
        details_p = heading.find_next_sibling('p', class_='trow')
        
        if details_p:
            # Feed URL
            # Priority: data-site attribute on the p tag
            if details_p.has_attr('data-site'):
                 decoded_url = urllib.parse.unquote(details_p['data-site'])
                 if decoded_url:
                     feed_data['feed_url'] = decoded_url
            
            # Fallback: Look for strong tag "RSS Feed" and then the next 'a' tag
            if 'feed_url' not in feed_data or not feed_data['feed_url']:
                rss_strong = details_p.find('strong', string=lambda text: 'RSS Feed' in text if text else False)
                if rss_strong:
                    rss_link = rss_strong.find_next('a', class_='ext')
                    if rss_link:
                        feed_data['feed_url'] = rss_link.get('href')

            # Website URL
            # Look for strong tag "Website" and then the next 'a' tag
            website_strong = details_p.find('strong', string=lambda text: 'Website' in text if text else False)
            if website_strong:
                website_link = website_strong.find_next('a', class_='extdomain')
                if website_link:
                    feed_data['website_url'] = website_link.get('href')
            
            # Description
            desc_span = details_p.find('span', class_='feed_desc')
            if desc_span:
                # Remove "MORE" link text if present
                for more in desc_span.find_all(class_='feed_desc_mrbtnew'):
                    more.decompose()
                for edit in desc_span.find_all(class_='pub-edit-desc'):
                    edit.decompose()
                feed_data['description'] = desc_span.get_text(strip=True)
            
            # Followers
            followers = {}
            eng_wrapper = details_p.find('span', class_='eng-outer-wrapper')
            if eng_wrapper:
                # Facebook
                fb_span = eng_wrapper.find('span', class_='fs-facebook')
                if fb_span:
                    val = fb_span.find('span', class_='eng_v')
                    if val:
                        followers['facebook'] = normalize_count(val.get_text(strip=True))
                
                # Twitter
                tw_span = eng_wrapper.find('span', class_='fs-twitter')
                if tw_span:
                    val = tw_span.find('span', class_='eng_v')
                    if val:
                        followers['twitter'] = normalize_count(val.get_text(strip=True))
                
                # Instagram
                ig_span = eng_wrapper.find('span', class_='fs-instagram')
                if ig_span:
                    val = ig_span.find('span', class_='eng_v')
                    if val:
                        followers['instagram'] = normalize_count(val.get_text(strip=True))
            
            feed_data['followers'] = followers

            # Image URL
            img_wrapper = details_p.find('span', class_='img-wrapper')
            if img_wrapper:
                img_tag = img_wrapper.find('img')
                if img_tag and img_tag.get('src'):
                     feed_data['image_url'] = img_tag.get('src')

        if feed_data.get('feed_url'):
            feeds.append(feed_data)
        
    return feeds, category

if __name__ == "__main__":
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = "https://rss.feedspot.com/ai_rss_feeds/"
    
    try:
        feeds, category = scrape_feedspot(url)
        print(json.dumps({'category': category, 'feeds': feeds}, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
