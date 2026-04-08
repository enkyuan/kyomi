# RSS Catalog Pipeline Integration

This directory is the absorbed Python pipeline from the former `rss-r-us` repository.

## Purpose

- Build a broad RSS feed catalog from multiple datasets.
- Export a canonical feed list for Cronos API import.
- Feed discovery search with pre-seeded feeds (for example, "Hacker News").

## Commands (from monorepo root)

- Install Python dependencies:
  - `bun run catalog:install`
- Export canonical catalog JSONL:
  - `bun run catalog:export`
- Import exported catalog into Postgres + Meilisearch:
  - `bun run catalog:import`
- Run end-to-end sync and smoke check:
  - `bun run catalog:sync`

## Output Contract

Exporter writes:

- `packages/sangam/processing/exports/catalog-feeds.jsonl`

Each JSONL record contains:

- `feed_url` (required)
- `title`
- `description`
- `link`
- `source`
- `language`
- `category`

## Validation

After import, run:

- `bun run catalog:smoke`

This asserts discover search returns expected seeded results for a known query.
