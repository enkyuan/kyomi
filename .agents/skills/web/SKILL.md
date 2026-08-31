---
name: web
description: Build, refactor, review, or debug the Kyomi TanStack Start web application in apps/web. Use for routes, SSR and server functions, product modules, app-local integrations and infrastructure, authentication UI, query behavior, responsive reader and inbox layouts, accessibility, shared UI or reader consumption, web environment values, and web tests or builds. Use when deciding whether frontend code belongs in a web domain, apps/web infrastructure, packages/ui, or packages/reader. Not for mobile-only, API-only, or final repository-wide verification work.
---

# Web

Keep routes thin, behavior domain-owned, and browser/server boundaries explicit.

## Establish context

1. Read `AGENTS.md`, `apps/web/README.md`, the closest route, the owning module, and its tests.
2. Load `$architecture` before changing ownership, creating a shared surface, or moving code across
   domains or workspaces.
3. Read [references/dependencies.md](references/dependencies.md) before using TanStack or evaluating
   Coss UI; inspect the resolved package types and matching official docs before editing.
4. Load `$packages` for changes to `packages/ui`, `packages/reader`, or another shared package.
5. Add `$design`, `$security`, `$environment`, and `$testing` when their boundaries apply.

## Organize the web app

```text
apps/web/src/
  app/                    App shell and runtime effects
  integrations/           Better Auth, PostHog, and TanStack Query providers
  lib/<capability>/        Infrastructure used across domains
  modules/<domain>/        Product behavior grouped by domain
    components/<area>/
    hooks/
    layouts/
    lib/
    queries/
    services/
    utils/
    page.tsx
  routes/                  TanStack route files and API handlers
```

- Add only the subdirectories a domain needs.
- Keep `src/routes` focused on route definitions, loaders, validated search, guards, metadata, and
  delegation to a module entrypoint.
- Keep feature components, hooks, queries, services, and utilities inside their owning domain until
  reuse across domains is real.
- Put cross-domain browser or isomorphic infrastructure in `src/lib/<capability>` and provider
  composition in `src/integrations/<provider>`.
- Keep hooks in the owning module. Use root `src/hooks` only for hooks with multiple domain
  consumers.
- Prefer concrete cross-domain imports when a barrel would create an inbox, feeds, sidebar, reader,
  or preferences cycle.

## Name files and surfaces

- Use lowercase kebab-case for authored files and directories; preserve TanStack route conventions
  and generated `routeTree.gen.ts`.
- Let directories carry domain context. Keep module source basenames to at most two semantic words
  when practical.
- Use role names such as `page.tsx`, `layout.tsx`, `schema.ts`, `options.ts`, `cache.ts`,
  `client.ts`, or a precise domain term.
- Use `index.tsx` for an area's primary component once its directory supplies the context. Add
  `index.ts` only as an intentional surface, not a single-use barrel.
- Name a single-hook file `use-<purpose>.ts`; keep exported hook symbols prefixed with `use`.

## Preserve runtime and package boundaries

- Treat TanStack Start modules as isomorphic unless an explicit server or client boundary says
  otherwise.
- Keep secrets, filesystem work, privileged provider calls, and server-only dependencies behind a
  validated `createServerFn` or API boundary.
- Do not import `@tanstack/react-start/server` from route files. Put server functions in the owning
  module service and call them from loaders.
- Import shared UI, icons, utilities, motion, and styles through `@kyomi/ui/*`.
- Import article behavior through the appropriate `@kyomi/reader` entrypoint.
- Import `LazyMotion`, `m`, `domAnimation`, or `domMax` from `@kyomi/ui/motion`; use `domMax` only
  when layout animation is required.
- Prefer Tailwind utilities over inline styles for small layout and typography changes.
- Keep the navigation sidebar on the left at every breakpoint. Change reader columns, not sidebar
  placement, for tablet layouts.
- Use explicit DOM markers for article enhancements; avoid broad selectors that can match an
  article wrapper unintentionally.

## Verify

1. Put tests under `tests/web/integration/src` and mirror the owning app path or shared-package
   surface. Do not add tests beside production files.
2. Run the narrowest Vitest target while iterating.
3. Run `bun run --cwd apps/web typecheck`, `lint`, and `fmt:check` as appropriate.
4. Run `bun run --cwd apps/web build` for route, SSR, environment, or production-bundle changes.
5. Finish through `$qa`.
