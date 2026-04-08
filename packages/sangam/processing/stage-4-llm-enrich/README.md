# Stage 4

The final stage. After we have a clean dataset to work with, we can extract several critical features from the feed using an LLM.

1. Mapping to top level category + tag generation
    - include content_type (indie blog, news, opinion, how-to, recipe, announcement)
    - Few shot prompting
2. LLM popularity estimate:
    - Score from 0-100
    - Both within its own category and globally
    - Include examples of popular feeds in each category in prompt (few-shot)
3. Generate description and improve titles for 'opml' dataset.

Each task gets its own prompt. Each prompt can contain 5-20 input samples for batch processing (necessary for 140k size).

Each prompt outputs valid JSON only. 

Remember to cap # of tags. 

Skip popularity scoring for dead feeds.

Understand how well these english prompts work for chinese / japanese feeds.

Combine popularity estimate with tranco rank, social follower count, quality score, etc. to get final score. 

And then we're done!

We can then backup this duckdb dataset to drive. Load it up into Meilisearch and Postgres. 

Follow up potential:
- Answering "How good of a feed is this?" for each. Different heuristics like how "complete" the articles are, volume, feed metadata completeness, etc, rich in images, etc etc.
- Standardize all language codes 
- Basic data analysis to get a feel for it perhaps. 
