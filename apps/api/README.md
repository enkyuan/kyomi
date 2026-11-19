# @kyomi/api

the backend. built with Bun and Elysia.

## layout

```text
src/
  app/       `runtime.ts` (`AppLive`, the one composition root), process boot (`boot/server.ts`, `worker.ts`, `scheduler.ts`, `dev.ts`, operator scripts), HTTP assembly, jobs, and `setup/main.ts` (`runMain`).
  adapters/  Effect services and Layers for auth, database, logging, Redis, queue, rate limits, search, and outbound HTTP, plus CORS and OpenAPI plugins.
  config/    typed environment loading (`AppConfig` service).
  modules/   product domains: articles, catalog, discover, favicon, feeds, folders, health, inbox, opml, queue, users.
  shared/    the typed error catalogue, the Elysia to Effect bridge and error rendering, network guards, and text decoding used across modules.
```

product routes mount under `/api/v1`. probes live at `/health`, `/ready`, `/queue/health`, and their `/api/*` mirrors.

## commands

| command                            | purpose                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `bun run dev:api`                  | follow Docker logs for `api`, `worker`, and `scheduler`.   |
| `bun run dev:api:host`             | run api, worker, and scheduler locally with file watching. |
| `bun run --cwd apps/api start`     | start the HTTP api.                                        |
| `bun run --cwd apps/api worker`    | start Redis Stream consumers.                              |
| `bun run --cwd apps/api scheduler` | claim due feeds and publish refresh jobs.                  |
| `bun run --cwd apps/api typecheck` | type-check.                                                |
| `bun run --cwd apps/api lint`      | lint.                                                      |
| `bun run --cwd apps/api fmt:check` | check formatting.                                          |

operator scripts live in `src/app/boot` because they write through api adapters. each file is one word of its script key (`category:audit` runs `audit.ts`):

| command                              | purpose                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bun run catalog:import`             | import `packages/catalog/processing/exports/catalog-feeds.jsonl` (`import.ts`).                                                                                                                                    |
| `bun run catalog:smoke`              | verify seeded catalog discovery (`smoke.ts`).                                                                                                                                                                      |
| `bun run categories:backfill`        | backfill feed and article categories (`backfill.ts`).                                                                                                                                                              |
| `bun run categories:report`          | report category coverage (`report.ts`).                                                                                                                                                                            |
| `bun run categories:audit`           | score category assignments against labels (`audit.ts`).                                                                                                                                                            |
| `bun run content:sanitizer-backfill` | backfill the article sanitizer version (`sanitizer.ts`).                                                                                                                                                           |
| `bun run content:urls-repair`        | one-off repair of stored feed and item URLs that carry a login or are not http(s) (`urls.ts`); dry run unless `--apply`, prints the feed ids to re-index in Meilisearch and the feeds whose own url holds a login. |

## notes

- env is loaded with `dotenvx` from `docker/.env` and `apps/api/.env`.
- database schema lives in `packages/db`; migrations run through the root `db:*` scripts.
- the api runs on Effect v4: services and Layers composed once in `src/app/runtime.ts`, typed errors rendered to one wire envelope, and every process entrypoint run through `runMain` so Layer scopes own shutdown. Elysia stays the HTTP adapter. see [`docs/architecture/api-effect.md`](../../docs/architecture/api-effect.md).
- tests swap Layers (`tests/api/integration/support/layers.ts`) instead of `mock.module` or patching `fetch`; tests that need no services run with `SKIP_ENV_VALIDATION=true bunx --no-install dotenvx run -f ../../docker/.env.example -f .env.example -- bun test ../../tests/api/integration/<path>` from `apps/api`.
- shared ingestion, queue contracts, and sanitization live in `@kyomi/ingest`. this app owns the executable processes that drive them.
