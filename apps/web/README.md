# @kyomi/web

the web client. built with TanStack Start.

## layout

```text
src/
  app/           app shell, runtime effects, and the pre-hydration shell script.
  hooks/         hooks used by more than one module.
  integrations/  Better Auth, PostHog, and TanStack Query wiring.
  lib/           app-local api, auth, query (client, cache, shared keys), shell, and timezone helpers.
  modules/       product domains: articles, auth, feeds, folders, inbox, preferences, reader, settings, sidebar.
  routes/        file-based TanStack Router routes and api handlers.
```

feature code belongs in `src/modules/*` under its product domain. modules depend on each other in one direction only:

```text
sidebar, settings, auth -> inbox -> reader -> articles -> feeds, folders, preferences
```

`src/lib`, `src/hooks`, and `src/integrations` sit below every module and never import one. `bun run check:boundaries` fails on a module cycle or an upward import. server functions live in `<module>/lib/api.ts`; query keys shared across modules live in `src/lib/query/keys.ts`.

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

env is loaded with `dotenvx` from `docker/.env` and `apps/web/.env`. there is no typed web env schema yet; values are read where they are used.

| variable | purpose |
| --- | --- |
| `SERVER_URL` | public origin for the web app (set for Docker and CI; not read by web code yet). |
| `API_ORIGIN` | backend api origin, read server-side in `src/lib/api.ts`. |
| `VITE_POSTHOG_KEY` | optional PostHog project key, read in `src/integrations/posthog/provider.tsx`. |
| `VITE_POSTHOG_HOST` | optional PostHog ingest host. |

## notes

- UI primitives come from `@kyomi/ui/components/*` (see `packages/ui/README.md`).
- article rendering comes from `@kyomi/reader`.
- `src/routeTree.gen.ts` is generated; don't edit it by hand.
