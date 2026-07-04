# stage 5: cleaning

corrects enrichment output before final ranking.

## goals

- remove or revise noisy LLM popularity scores.
- normalize category, tag, language, title, and description fields.
- drop fields that aren't useful for discovery or import.

## notes

popularity scores need review before they're trusted for ranking. high-scoring outliers should be corrected or sent back through a narrower prompt.
