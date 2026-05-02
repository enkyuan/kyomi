# RSS Catalog Pipeline 

This directory is the absorbed Python pipeline from the former `rss-r-us` repository.

This package is intentionally optional/offline for Cronos app runtime: normal app setup/dev does not require Poetry or catalog sync.

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

- `packages/catalog/processing/exports/catalog-feeds.jsonl`

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

## Local Scheduled Sync

Use the repository script for local cron scheduling:

- `bash packages/catalog/scripts/sync.sh`
- or from package scope: `bun run --cwd packages/catalog sync`

The script:

- Runs `bun run catalog:sync` from repo root.
- Writes logs to `.catalog-sync-logs/catalog-sync-YYYY-MM-DD.log`.
- Uses `.catalog-sync.lock` to prevent overlapping runs.

Example `crontab -e` entry (every 30 minutes):

- `*/30 * * * * /bin/bash /ABSOLUTE_PATH_TO_REPO/packages/catalog/scripts/sync.sh`

Troubleshooting:

- If runs are skipped repeatedly, check for stale lock directory: `.catalog-sync.lock`.
- If sync fails, inspect latest log in `.catalog-sync-logs/`.
- Make sure `bun`, project `.env` files, and local Postgres/Redis/Meilisearch are available in the cron environment.
