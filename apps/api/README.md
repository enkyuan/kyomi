# @kyomi/api

Kyomi's Bun/Elysia backend for auth, feeds, articles, folders, search, OPML imports, and background jobs.

## Layout

```text
src/
  app/       Process boot, HTTP assembly, jobs, and setup helpers.
  adapters/  Auth, database, logging, Redis, queue, search, CORS, and OpenAPI boundaries.
  config/    Typed environment loading.
  modules/   Product domains: articles, discover, favicon, feeds, folders, health, inbox, OPML, queue, users.
  shared/    Cross-domain errors, HTTP helpers, network guards, text helpers, and small utilities.
```

Product routes are mounted under `/api/v1`. Operational probes are available at `/health`, `/ready`, `/queue/health`, and `/api/*` mirrors.

## Commands

Run from the repository root unless noted otherwise.

| Command | Purpose |
| --- | --- |
| `bun run dev:api` | Follow Docker logs for `api`, `worker`, and `scheduler`. |
| `bun run dev:api:host` | Run API, worker, and scheduler locally with file watching. |
| `bun run --cwd apps/api start` | Start only the HTTP API. |
| `bun run --cwd apps/api worker` | Start Redis Stream consumers. |
| `bun run --cwd apps/api scheduler` | Claim due feeds and publish refresh jobs. |
| `bun run --cwd apps/api typecheck` | Type-check the API package. |
| `bun run --cwd apps/api lint` | Lint API source. |
| `bun run --cwd apps/api fmt:check` | Check API formatting. |

Catalog import helpers live here because they write through API adapters:

| Command | Purpose |
| --- | --- |
| `bun run catalog:import` | Import `packages/catalog/processing/exports/catalog-feeds.jsonl`. |
| `bun run catalog:smoke` | Verify seeded catalog discovery works. |

## Notes

- Env is loaded with `dotenvx` from `docker/.env` and `apps/api/.env`.
- Database schema lives in `packages/db`; migrations run through root `db:*` scripts.
- Shared feed ingestion, queue contracts, and sanitization live in `@kyomi/worker`; executable API processes stay in this app.
