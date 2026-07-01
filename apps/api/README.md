# @kyomi/api

Kyomi's Bun/Elysia API runtime.

## Roles

- `bun run --cwd apps/api start`: HTTP API only.
- `bun run --cwd apps/api worker`: Redis Stream consumers for refresh and OPML jobs.
- `bun run --cwd apps/api scheduler`: due-feed scheduler that claims feeds in Postgres and publishes refresh jobs.
- `bun run --cwd apps/api dev:host`: local host mode that starts the API, worker, and scheduler together.

Product routes live under `/api/v1`. Operational probes are available at `/health`, `/ready`, `/queue/health`, and `/api/*` mirrors.
