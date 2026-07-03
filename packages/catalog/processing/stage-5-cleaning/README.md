# Stage 5: Cleaning

Catalog pipeline stage for correcting enrichment output before final ranking.

## Goals

- Remove or revise noisy LLM popularity scores.
- Normalize category, tag, language, title, and description fields.
- Keep only fields that are useful for Kyomi discovery and import.

## Notes

Popularity scores need review before they are trusted for ranking. High-scoring outliers should be corrected or sent back through a narrower prompt.
