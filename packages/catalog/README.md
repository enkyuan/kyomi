# @kyomi/catalog

Optional offline Python pipeline for building the seeded RSS feed catalog used by Kyomi discovery.

This package is not required for normal app development. The web and API apps run without `uv` or catalog sync.

## Layout

```text
processing/
  feedspot/                  Feedspot scraper utilities.
  stage-1-merge/             Source merge inputs.
  stage-2-fetching/          Feed fetching and metadata enrichment.
  stage-3-favicon-dedupe/   Favicon recovery, DuckDB import, and dedupe.
  stage-4-llm-enrich/       LLM category, tag, title, and description enrichment.
  stage-5-cleaning/         Post-enrichment cleanup.
  stage-6-reranking/        Category ranking adjustments.
  exports/                  JSONL output consumed by apps/api import scripts.
```

## Commands

Run from the repository root.

| Command | Purpose |
| --- | --- |
| `bun run catalog:install` | Install catalog Python dependencies with `uv`. |
| `bun run catalog:export` | Export canonical catalog JSONL. |
| `bun run catalog:import` | Import exported feeds into the app database and search index. |
| `bun run catalog:smoke` | Verify catalog search returns expected seeded results. |
| `bun run catalog:sync` | Export, import, and smoke test. |
| `bun run catalog:sync:local` | Run the local scheduled-sync wrapper. |
| `bun run --cwd packages/catalog typecheck` | Type-check the Python catalog package. |

## Output

`catalog:export` writes `packages/catalog/processing/exports/catalog-feeds.jsonl`.

Each JSONL record uses this contract:

| Field | Required | Notes |
| --- | --- | --- |
| `feed_url` | Yes | Canonical RSS/Atom feed URL. |
| `title` | No | Display title. |
| `description` | No | Short source description. |
| `link` | No | Website URL. |
| `source` | No | Source dataset name. |
| `language` | No | Language code when known. |
| `category` | No | Top-level catalog category. |
| `content_type` | No | Content type hint (e.g. `article`, `video`). |
| `quality_score` | No | Numeric quality/popularity score when known. |

`catalog:import` preserves these fields: `language`, `content_type`, and `quality_score`
are stored on the feed (with `metadata_provenance = catalog`), and `category` is upserted as
a `catalog`-provenance category assignment. It also emits a validation report and a dry-run
mode (`--dry-run`) that prints counts for imported feeds, category/language assignments,
duplicate canonical URLs, and missing-field totals without writing.

## Notes

- `scripts/catalog/sync.ts` writes logs to `.catalog-sync-logs/` and uses `.catalog-sync.lock` to prevent overlapping local runs.
- Run `bun run setup:app` before importing into a fresh local database.
- Keep catalog dependencies isolated here; normal Kyomi setup should not require Poetry, `uv`, or the catalog pipeline.
