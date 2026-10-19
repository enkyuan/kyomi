# @kyomi/api

the backend. built with Bun and Elysia.

## layout

```text
src/
  app/       process boot (`boot/server.ts`, `worker.ts`, `scheduler.ts`, `dev.ts`, operator scripts), HTTP assembly, and job setup.
  adapters/  auth, database, logging, Redis, queue, search, CORS, and OpenAPI boundaries.
  config/    typed environment loading.
  modules/   product domains: articles, discover, favicon, feeds, folders, health, inbox, opml, queue, users.
  shared/    errors, HTTP helpers, network guards, and text decoding used across modules.
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

operator scripts live in `src/app/boot` because they write through api adapters. each file is one word of its script key (`category:audit` runs `audit.ts`):

| command | purpose |
| --- | --- |
| `bun run catalog:import` | import `packages/catalog/processing/exports/catalog-feeds.jsonl` (`import.ts`). |
| `bun run catalog:smoke` | verify seeded catalog discovery (`smoke.ts`). |
| `bun run categories:backfill` | backfill feed and article categories (`backfill.ts`). |
| `bun run categories:report` | report category coverage (`report.ts`). |
| `bun run categories:audit` | score category assignments against labels (`audit.ts`). |
| `bun run content:sanitizer-backfill` | backfill the article sanitizer version (`sanitizer.ts`). |

## notes

- env is loaded with `dotenvx` from `docker/.env` and `apps/api/.env`.
- database schema lives in `packages/db`; migrations run through the root `db:*` scripts.
- shared ingestion, queue contracts, and sanitization live in `@kyomi/worker`. this app owns the executable processes that drive them.
