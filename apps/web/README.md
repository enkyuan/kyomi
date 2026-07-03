# @kyomi/web

Kyomi's TanStack Start web app for the inbox, reader, feed management, settings, and account flows.

## Layout

```text
src/
  app/           App shell and runtime effects.
  hooks/         Cross-cutting React hooks.
  integrations/  Better Auth, PostHog, and TanStack Query wiring.
  lib/           App-local API, favicon, query, schema, shell, and theme helpers.
  modules/       Product domains: auth, feeds, folders, inbox, preferences, reader, settings, sidebar.
  routes/        File-based TanStack Router routes and API handlers.
  utils/         Small shared utilities.
```

Keep feature code inside `src/modules/*` when it belongs to a product domain. Use `src/hooks` only for hooks shared across modules.

## Commands

Run from the repository root unless noted otherwise.

| Command | Purpose |
| --- | --- |
| `bun run dev:web` | Start the Vite dev server on port 3000. |
| `bun run --cwd apps/web build` | Build the TanStack Start app. |
| `bun run --cwd apps/web preview` | Preview the production build. |
| `bun run --cwd apps/web typecheck` | Type-check the web app. |
| `bun run --cwd apps/web lint` | Lint web source. |
| `bun run --cwd apps/web fmt:check` | Check web formatting. |
| `bun run test:web` | Run web integration tests from `tests/web`. |

## Environment

Env is loaded with `dotenvx` from `docker/.env` and `apps/web/.env`.

| Variable | Purpose |
| --- | --- |
| `SERVER_URL` | Public origin for the web app. |
| `API_ORIGIN` | Backend API origin for auth and data. |
| `VITE_POSTHOG_KEY` | Optional PostHog project key. |
| `VITE_POSTHOG_HOST` | Optional PostHog ingest host. |

Typed client env lives in `src/env.ts`.

## Notes

- Shared UI primitives come from `@kyomi/ui`.
- Shared article rendering comes from `@kyomi/reader`.
- Generated routes live in `src/routeTree.gen.ts`; do not edit that file by hand.
