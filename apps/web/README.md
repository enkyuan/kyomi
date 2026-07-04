# @kyomi/web

the web client. built with TanStack Start.

## layout

```text
src/
  app/           app shell and runtime effects.
  hooks/         hooks shared across modules.
  integrations/  Better Auth, PostHog, and TanStack Query wiring.
  lib/           app-local api, favicon, query, schema, shell, and theme helpers.
  modules/       product domains: auth, feeds, folders, inbox, preferences, reader, settings, sidebar.
  routes/        file-based TanStack Router routes and api handlers.
  utils/         small helpers.
```

feature code belongs in `src/modules/*` under its product domain. `src/hooks` is only for hooks used by more than one module.

## commands

| command | purpose |
| --- | --- |
| `bun run dev:web` | start the Vite dev server on port 3000. |
| `bun run --cwd apps/web build` | build the app. |
| `bun run --cwd apps/web preview` | preview the production build. |
| `bun run --cwd apps/web typecheck` | type-check. |
| `bun run --cwd apps/web lint` | lint. |
| `bun run --cwd apps/web fmt:check` | check formatting. |
| `bun run test:web` | run web integration tests from `tests/web`. |

## environment

env is loaded with `dotenvx` from `docker/.env` and `apps/web/.env`. typed client env lives in `src/env.ts`.

| variable | purpose |
| --- | --- |
| `SERVER_URL` | public origin for the web app. |
| `API_ORIGIN` | backend api origin. |
| `VITE_POSTHOG_KEY` | optional PostHog project key. |
| `VITE_POSTHOG_HOST` | optional PostHog ingest host. |

## notes

- UI primitives come from `@kyomi/ui`.
- article rendering comes from `@kyomi/reader`.
- `src/routeTree.gen.ts` is generated; don't edit it by hand.
