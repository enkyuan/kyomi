# @kyomi/catalog

offline Python pipeline that builds the seeded RSS feed catalog used by discovery.

optional. normal app development runs without `uv` or catalog sync.

## layout

```text
processing/
  feedspot/                 Feedspot scraper.
  stage-1-merge/            merge source inputs.
  stage-2-fetching/         feed fetching and metadata enrichment.
  stage-3-favicon-dedupe/   favicon recovery, DuckDB import, and dedupe.
  stage-4-llm-enrich/       LLM enrichment of categories, tags, titles, descriptions.
  stage-5-cleaning/         post-enrichment cleanup.
  stage-6-reranking/        category ranking adjustments.
  exports/                  JSONL output consumed by `apps/api` import scripts.
```

## commands

run from the repository root.

| command | purpose |
| --- | --- |
| `bun run catalog:install` | install Python dependencies with `uv`. |
| `bun run catalog:export` | export canonical catalog JSONL. |
| `bun run catalog:import` | import exported feeds into the database and search index. |
| `bun run catalog:smoke` | verify catalog search returns expected seeded results. |
| `bun run catalog:sync` | export, import, and smoke test in one pass. |
| `bun run catalog:sync:local` | run the local scheduled-sync wrapper. |
| `bun run --cwd packages/catalog typecheck` | type-check. |

## output

`catalog:export` writes `packages/catalog/processing/exports/catalog-feeds.jsonl`. each record follows this contract:

| field | required | notes |
| --- | --- | --- |
| `feed_url` | yes | canonical RSS/Atom feed URL. |
| `title` | no | display title. |
| `description` | no | short source description. |
| `link` | no | website URL. |
| `source` | no | source dataset name. |
| `language` | no | language code when known. |
| `category` | no | top-level catalog category. |
| `content_type` | no | content type hint (e.g. `article`, `video`). |
| `quality_score` | no | numeric quality/popularity score when known. |

`catalog:import` preserves these fields: `language`, `content_type`, and `quality_score`
are stored on the feed (with `metadata_provenance = catalog`), and `category` is upserted as
a `catalog`-provenance category assignment. it also emits a validation report and a dry-run
mode (`--dry-run`) that prints counts for imported feeds, category/language assignments,
duplicate canonical URLs, and missing-field totals without writing.

## notes

- `scripts/catalog/sync.ts` writes logs to `.catalog-sync-logs/` and holds `.catalog-sync.lock` to prevent overlapping local runs.
- run `bun run setup:app` before importing into a fresh local database.
- keep catalog dependencies isolated here. a normal kyomi setup should not require Poetry, `uv`, or the pipeline.
