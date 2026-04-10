We ran stage 2 fetching, which downloaded all the article data, and enriched as much metadata from the RSS feed as possible, and dropped dead broken feeds. 

The result is a schema somewhat like this:
```json
{
  "feed": {
    "title": "Murky Depths",
    "feed_url": "https://www.fromthemurkydepths.co.uk/feed/",
    "domain": "fromthemurkydepths.co.uk",
    "summary": "A local news source offering updates and commentary on various developments in London, providing insights into urban change and community issues.",
    "language": "en-GB",
    "kind": "feed",
    "category": "Regional & Local",
    "subcategory": "Countries > UK > London",
    "tags": [
      "News",
      "Local",
      "London",
      "Urban"
    ],
    "keywords": [
      "news",
      "London",
      "urban development"
    ],
    "popularity_score": null,
    "image_url": "https://i0.wp.com/www.fromthemurkydepths.co.uk/wp-content/uploads/2025/05/cropped-MD-orange.jpg?fit=32%2C32&ssl=1",
    "source_dataset": "feeeed",
    "original_source_file": "local.json",
    "author": null,
    "channel_id": null,
    "subreddit": null,
    "bluesky_did": null,
    "parsed_description": "News and views in London",
    "parsed_tags": [],
    "content_hash": "2ec5adc990fff26f5facc9fcfb2a4e5d25d15559da7e68afb50a63700f3506b7"
  },
  "items": [
    {
      "title": "Woolwich block flat conversion approved",
      "link": "https://www.fromthemurkydepths.co.uk/2025/12/06/woolwich-block-flat-conversion-approved/",
      "published_at": 1765085085.0,
      "summary": "....",
      "content_html": "...",
      "author": "J Smith",
      "guid": "https://www.fromthemurkydepths.co.uk/?p=55219",
      "image_url": null,
      "tags": [
        "Woolwich",
        "Woolwich conversion"
      ]
    },
  ],
  "fetch_details": {
    "fetch_date": 1765156191.33051,
    "http_status": 200,
    "http_etag": "\"a52211170869270cddaac34522691e68-gzip\"",
    "http_last_modified": "Sat, 06 Dec 2025 23:24:45 GMT",
    "content_hash": "2ec5adc990fff26f5facc9fcfb2a4e5d25d15559da7e68afb50a63700f3506b7",
    "server_header": "nginx",
    "final_url": "https://www.fromthemurkydepths.co.uk/feed/",
    "permanent_redirect": false
  },
  "stats": {
    "last_post_date": 1765085085.0,
    "posts_per_week": 126.69,
    "median_post_interval": 4774
  }
}
```

Or perhaps from another dataset `opml`:
```json
{
  "feed": {
        "title": "CNN.com - Technology",
        "feed_url": "http://rss.cnn.com/rss/edition_technology.rss",
        "website_url": "http://www.cnn.com/TECH/index.html?eref=rss_tech",
        "domain": "rss.cnn.com",
        "summary": null,
        "language": "en",
        "kind": "feed",
        "category": null,
        "subcategory": "News > Tech",
        "source_dataset": "opml",
        "original_source_file": "rss_subscriptions.opml",
        "image_url": "http://i.cdn.turner.com/cnn/.e/img/1.0/logo/cnn.logo.rss.gif",
        "author": null,
        "parsed_description": "CNN.com delivers up-to-the-minute news and information on the latest top stories, weather, entertainment, politics and more.",
        "parsed_tags": [],
        "content_hash": "a8ec55d1e88e60ad19de336fdc57bed8a1165051b8b4119e5e02bf33c4b94c43"
    },
    ...
}
```

Or from the last possible dataset `feedspot`:
```json
{
  "feed": {
    "title": "Evie Sparkes Blog",
    "feed_url": "https://www.eviesparkes.co.uk/feed/",
    "website_url": "https://www.eviesparkes.co.uk/law-of-attraction-blog/",
    "domain": "eviesparkes.co.uk",
    "summary": "Evie Sparkes's blog offers practical mindset-alignment insights fused with LOA wisdom—from rewiring the subconscious and shaking off stuck manifestation energy to manifesting intentions with ease and emotional alignment",
    "language": "en-GB",
    "kind": "feed",
    "category": "Health & Wellness",
    "subcategory": "Law of Attraction",
    "followers": {
        "facebook": 1200,
        "instagram": 4200,
        "twitter": 8200,
    },
    "image_url": "https://i1.feedspot.com/8663778.jpg?t=1763034419",
    "source_dataset": "feedspot",
    "original_source_file": "law of attraction.json",
    "author": null,
    "parsed_description": "",
    "parsed_tags": [],
    "content_hash": "0183e4a210618dc0fcd1453c801b449364f507351cdda94716ee1d19c6813f8f"
  },
  ...
}
```

And we have about 140,000 entries like this, comprising of of a 21GB JSONL file. 

## Running Stage 3

You can run the entire pipeline using `main.py`. This handles ingestion into DuckDB, favicon fetching, and deduplication/scoring.

```bash
# Install dependencies
poetry install

# Run the pipeline (Dry Run - processes 1000 feeds)
poetry run python3 main.py --dry-run

# Run the full pipeline
poetry run python3 main.py --input ../stage-2-fetching/enriched_feeds.jsonl --output stage_3_feeds.parquet
```

The pipeline implementation includes:
1.  **Ingestion**: Loads JSONL data into a persistent `feeds.duckdb` database.
2.  **Favicon Fetching**: Concurrently fetches missing favicons with a progress bar.
3.  **Deduplication & Scoring**: Uses DuckDB SQL to calculate a quality score and deduplicate based on `content_hash`.

### What are the next steps?

First off, the dataset is too huge to load into memory. Try converting to DuckDB and work with it. 

Wait the trank_rank and domain are based on the feed_url, not the website_url. We should fix that.

1. Missing image_url for ~8-9k feeds. Run extract_favicon_and_canonical_url from readspace/favicon.py on each website_url
2. Deduplication based on content_hash and other heuristics (e.g. extremely similar title). See how many we filter out
