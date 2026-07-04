# stage 4: LLM enrichment

improves categories, tags, descriptions, titles, and ranking signals with batched LLM prompts.

## goals

- map feeds to top-level categories and capped tag lists.
- improve weak titles and descriptions, especially for OPML-derived feeds.
- estimate popularity signals for live feeds only. combine them with non-LLM signals later.

## layout

```text
batch_scripts/  batch execution helpers.
experiments/    prompt and scoring experiments.
preprocess/     input preparation.
```

## notes

- prompts must return valid JSON.
- keep batch sizes small enough for reliable validation and retry.
- validate prompts against non-English feeds before applying them to the full catalog.
