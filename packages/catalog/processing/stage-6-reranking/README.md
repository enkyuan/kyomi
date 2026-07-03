# Stage 6: Reranking

Catalog pipeline stage for final category ordering after enrichment and cleaning.

## Goals

- Prevent duplicate variants of the same source from crowding a category.
- Demote low-value outliers with inflated popularity scores.
- Prefer representative, high-quality feeds for seeded discovery results.

## Notes

Popularity alone is not a reliable sort key. Ranking should combine quality, dedupe, category fit, and curated examples for major languages and categories.
