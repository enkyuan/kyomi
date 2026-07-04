# stage 6: reranking

final category ordering after enrichment and cleaning.

## goals

- prevent duplicate variants of the same source from crowding a category.
- demote low-value outliers with inflated popularity scores.
- prefer representative, high-quality feeds for seeded discovery results.

## notes

popularity alone is not a reliable sort key. ranking combines quality, dedupe, category fit, and curated examples for major languages and categories.
