# kyomi

a personal reading inbox for RSS.

## layout

```text
apps/
  api/     Bun/Elysia backend.
  mobile/  react native client.
  web/     TanStack Start web client.
packages/
  catalog/  offline feed catalog pipeline.
  db/       Drizzle schema and migrations.
  reader/   article rendering.
  ui/       React UI primitives.
  worker/   queue, ingestion, favicon, sanitization.
tests/       api and web integration suites.
docker/      local Postgres, Redis, search, and storage.
```

product code lives inside its owning app or package. runtime code shared across apps belongs in `packages/*`. cross-app tests mirror the source tree under `tests/`.

## setup

```sh
bun install
bun run bootstrap
```

for catalog enrichment and import, use `bun run bootstrap:full`.

env is loaded from `docker/.env` and each app's local `.env`. copy the matching `.env.example` to start.

## commands

run from the repository root unless noted.

| command | purpose |
| --- | --- |
| `bun run dev` | start web and api together. |
| `bun run dev:web` | start the web app. |
| `bun run dev:api` | follow api, worker, and scheduler Docker logs. |
| `bun run dev:api:host` | run api, worker, and scheduler locally with file watching. |
| `bun run docker:up` | start local infrastructure. |
| `bun run docker:down` | stop local infrastructure. |
| `bun run db:migrate` | apply database migrations. |
| `bun run typecheck` | type-check every workspace. |
| `bun run lint` | lint every workspace. |
| `bun run fmt:check` | check formatting. |
| `bun run test` | run web and api integration tests. |
| `bun run catalog:sync` | export, import, and smoke-test the feed catalog. |

## notes

- shared UI primitives live in `packages/ui`; app-specific UI stays in the owning app.
- shared ingestion and queue code lives in `packages/worker`; the executable api and worker processes live in `apps/api`.
- database schema lives in `packages/db`.
- generated files (route trees, migrations) change through their owning scripts, not by hand.
