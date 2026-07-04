# @kyomi/api

the backend. built with Bun and Elysia.

## layout

```text
src/
  app/       process boot, HTTP assembly, and job setup.
  adapters/  auth, database, logging, Redis, queue, search, CORS, and OpenAPI boundaries.
  config/    typed environment loading.
  modules/   product domains: articles, discover, favicon, feeds, folders, health, inbox, opml, queue, users.
  shared/    errors, HTTP helpers, network guards, and utilities used across modules.
```

product routes mount under `/api/v1`. probes live at `/health`, `/ready`, `/queue/health`, and their `/api/*` mirrors.

## commands

| command | purpose |
| --- | --- |
| `bun run dev:api` | follow Docker logs for `api`, `worker`, and `scheduler`. |
| `bun run dev:api:host` | run api, worker, and scheduler locally with file watching. |
| `bun run --cwd apps/api start` | start the HTTP api. |
| `bun run --cwd apps/api worker` | start Redis Stream consumers. |
| `bun run --cwd apps/api scheduler` | claim due feeds and publish refresh jobs. |
| `bun run --cwd apps/api typecheck` | type-check. |
| `bun run --cwd apps/api lint` | lint. |
| `bun run --cwd apps/api fmt:check` | check formatting. |

catalog import helpers live here because they write through api adapters:

| command | purpose |
| --- | --- |
| `bun run catalog:import` | import `packages/catalog/processing/exports/catalog-feeds.jsonl`. |
| `bun run catalog:smoke` | verify seeded catalog discovery. |

## notes

- env is loaded with `dotenvx` from `docker/.env` and `apps/api/.env`.
- database schema lives in `packages/db`; migrations run through the root `db:*` scripts.
- shared ingestion, queue contracts, and sanitization live in `@kyomi/worker`. this app owns the executable processes that drive them.
