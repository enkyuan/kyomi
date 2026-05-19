# @vols.rss/web

TanStack Start frontend for Vols.rss: RSS inbox, reader, feed management, and account settings.

## Prerequisites

Run from the [monorepo root](../../) unless noted otherwise.

- [Bun](https://bun.sh) (repo `packageManager`)
- Docker (Postgres and shared infra via `docker/`)
- `apps/api` running for authenticated feed and inbox API calls

Typical first-time setup:

```bash
bun install
bun run bootstrap    # docker + migrations (see root package.json)
```

Copy `apps/web/.env.example` to `apps/web/.env` (or `.env.local`) and set `API_ORIGIN` to your API base URL (for example `http://localhost:8000`).

## Development

From the repo root:

```bash
bun run dev:web
```

Or from this directory:

```bash
bun run dev
```

The dev server listens on port **3000**. Env files are loaded with [dotenvx](https://dotenvx.com) from `docker/.env` and `apps/web/.env`.

| Script | Description |
|--------|-------------|
| `bun run dev` | Vite dev server |
| `bun run build` | Production build |
| `bun run preview` | Preview production build |
| `bun run typecheck` | TypeScript (`tsgo`) |
| `bun run test` | Vitest unit tests |

## Environment

| Variable | Scope | Purpose |
|----------|-------|---------|
| `SERVER_URL` | Server | Public origin of this app (no trailing slash) |
| `API_ORIGIN` | Server | Backend API used for auth and data |
| `VITE_POSTHOG_KEY` | Client | Optional PostHog analytics |
| `VITE_POSTHOG_HOST` | Client | PostHog ingest host (defaults in provider if unset) |

Typed client env is defined in `src/env.ts` ([T3 Env](https://env.t3.gg)). Add new `VITE_*` variables there when introducing client-side config.

Auth is handled with [Better Auth](https://www.better-auth.com) (`src/integrations/better-auth/`, `src/lib/auth-client.ts`). Session and API routes proxy through TanStack Start server handlers under `src/routes/api/`.

## Source layout

```
src/
  app/           App shell (sidebar + main layout)
  routes/        File-based TanStack Router routes
  modules/       Feature modules (primary place for product code)
  hooks/         Cross-cutting React hooks
  integrations/  Auth, TanStack Query, PostHog wiring
  lib/           App-local utilities and auth helpers
  tests/         Vitest unit and integration tests
```

### Feature modules (`src/modules/`)

Each module groups UI, hooks, and client services for one area of the product:

| Module | Responsibility |
|--------|----------------|
| `auth` | Login and registration |
| `inbox` | Item list, filters, layouts, preferences |
| `reader` | Article detail and reader toolbar |
| `feeds` | Follow sources, manage feeds, list rows |
| `folders` | Folder creation and organization |
| `sidebar` | Navigation, pinned feeds, workspace header |
| `settings` | Account, appearance, billing dialogs |
| `preferences` | Shared user preference queries |

Import from a module’s public API (`@modules/inbox`, etc.) or a concrete path when avoiding barrel cycles. Prefer direct paths over `@modules/*/index` when a hook only needs one file (see `docs/repo-layout.md`).

### Shared UI

Primitives and icons live in [`packages/ui`](../../packages/ui/). Import components as `@vols.rss/ui/button`, icons as `@vols.rss/ui/icons/empty-state`. Tailwind scans `packages/ui/src` via `src/styles.css` `@source`.

### Path aliases

| Alias | Maps to |
|-------|---------|
| `@/*` | `src/*` |
| `@modules/*` | `src/modules/*` |
| `@hooks/*` | `src/hooks/*` |
| `@lib/*` | `src/lib/*` |
| `@vols.rss/ui/*` | `packages/ui/src/*` |

## Routing

Routes are file-based under `src/routes/`. The generated route tree is `src/routeTree.gen.ts` (do not edit by hand).

| Route | Purpose |
|-------|---------|
| `/` | Landing / redirect |
| `/inbox` | Main reading experience |
| `/login`, `/register` | Auth |
| `/api/auth/*` | Better Auth handler |
| `/api/favicon` | Favicon proxy |

Layouts and providers are composed in `src/routes/__root.tsx` and `src/app/app-shell.tsx`.

## Testing

```bash
bun run test
```

Tests live in the monorepo root at [`tests/`](../../tests/README.md): `tests/web/integration` (Vitest + jsdom) and `tests/api/integration` (bun). E2E folders are reserved for future Playwright/API flow tests.

## Related docs

- [Monorepo layout](../../docs/repo-layout.md)
- [API app](../api/) (companion backend)
- [packages/ui icons](../../packages/ui/src/icons/README.md)
