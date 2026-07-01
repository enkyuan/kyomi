# Feedspot Scraper

This tool scrapes structured data from Feedspot RSS feed lists (e.g., `https://rss.feedspot.com/technology_rss_feeds/`).

## Dependencies

The following Python packages are required (managed via `uv` in `pyproject.toml`):
- `requests`
- `beautifulsoup4`
- `lxml`

## Usage

You can run the scraper directly from the command line:

```bash
python3 processing/feedspot/scraper.py [URL]
```

If no URL is provided, it defaults to `https://rss.feedspot.com/technology_rss_feeds/`.

## Output

The script outputs a JSON object containing:
- `category`: The category of the feeds (extracted from the page title).
- `feeds`: A list of objects, where each object represents a feed and contains:
  - `title`: The title of the feed.
  - `feed_url`: The RSS feed URL (if available).
  - `website_url`: The website URL.
  - `description`: A brief description of the feed.
  - `followers`: A dictionary containing follower counts for Facebook, Twitter, and Instagram (if available).

### Example Output

```json
{
  "category": "Technology",
  "feeds": [
    {
      "title": "TechCrunch RSS Feed",
      "feed_url": "https://techcrunch.com/feed/",
      "website_url": "https://techcrunch.com/",
      "description": "TechCrunch is a leading technology media property, dedicated to obsessively profiling startups, reviewing new internet products, and breaking tech news.",
      "followers": {
        "facebook": 2800000,
        "twitter": 10300000,
        "instagram": 1500000
      }
    },
    ...
  ]
}
```

## Implementation Details

The scraper uses `BeautifulSoup` with the `lxml` parser to parse the HTML. It targets specific CSS classes and structure observed in Feedspot pages:
- Feeds are contained within `div#fsb`.
- Each feed has a title in `h3.feed_heading`.
- Details are in the following `p.trow`.
- URLs and descriptions are extracted based on specific class names and text markers.
