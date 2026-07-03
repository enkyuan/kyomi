# Kyomi

Kyomi is a monorepo for the web, API, worker, reader, catalog, and mobile surfaces that power a personal reading inbox.

## Layout

```text
apps/
  api/     Bun/Elysia API, auth, feeds, folders, articles, and jobs.
  mobile/  Native mobile app surface.
  web/     TanStack Start web app.
packages/
  catalog/  Offline feed catalog processing.
  db/       Drizzle schema, migrations, and database tooling.
  reader/   Shared article rendering primitives.
  ui/       Shared React UI primitives.
  worker/   Shared queue, feed ingestion, favicon, and sanitization code.
tests/       API and web integration suites.
docker/      Local Postgres, Redis, search, storage, and supporting services.
```

Keep product code inside the owning app or package. Shared runtime code should live in `packages/*`; cross-app tests should mirror the source tree under `tests/`.

## Setup

Install dependencies with Bun, then start local infrastructure and run migrations:

```sh
bun install
bun run bootstrap
```

For catalog enrichment and import, use the full setup:

```sh
bun run bootstrap:full
```

Env is loaded from `docker/.env` plus app-local `.env` files. Start from the matching `.env.example` files when configuring a new machine.

## Commands

Run from the repository root unless noted otherwise.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start web and API development tasks. |
| `bun run dev:web` | Start only the web app. |
| `bun run dev:api` | Follow API, worker, and scheduler Docker logs. |
| `bun run dev:api:host` | Run API, worker, and scheduler locally with file watching. |
| `bun run docker:up` | Start local infrastructure. |
| `bun run docker:down` | Stop local infrastructure. |
| `bun run db:migrate` | Apply database migrations. |
| `bun run typecheck` | Type-check all workspaces. |
| `bun run lint` | Lint all workspaces. |
| `bun run fmt:check` | Check formatting. |
| `bun run test` | Run web and API integration tests. |
| `bun run catalog:sync` | Export, import, and smoke-test the feed catalog. |

## Notes

- Web UI lives in `apps/web`; shared UI primitives live in `packages/ui`.
- API processes live in `apps/api`; shared ingestion and queue code lives in `packages/worker`.
- Database schema lives in `packages/db`.
- Generated files such as route trees and migrations should be changed through their owning scripts.
