# Stage 4: LLM Enrichment

Catalog pipeline stage for improving categories, tags, descriptions, titles, and ranking signals with batched LLM prompts.

## Goals

- Map feeds to top-level categories and capped tag lists.
- Improve weak titles and descriptions, especially for OPML-derived feeds.
- Estimate popularity signals only for live feeds and combine them later with non-LLM signals.

## Layout

```text
batch_scripts/  Batch execution helpers.
experiments/    Prompt and scoring experiments.
preprocess/     Input preparation.
```

## Notes

- Prompts should return valid JSON only.
- Batch sizes should stay small enough for reliable validation and retry.
- Validate prompts against non-English feeds before applying them to the full catalog.
