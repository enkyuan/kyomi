# Kyomi repository organization

Use these rules when adding, moving, renaming, or reviewing source and test files. Preserve current
Kyomi paradigms before applying general preferences.

## Contents

- [Repository map](#repository-map)
- [Placement rules](#placement-rules)
- [Growth inside domains](#growth-inside-domains)
- [Naming](#naming)
  - [API naming](#api-naming)
  - [Web naming](#web-naming)
- [Imports and public surfaces](#imports-and-public-surfaces)
- [Generated and platform artifacts](#generated-and-platform-artifacts)
- [Review checklist](#review-checklist)

## Repository map

```text
apps/
  web/
    src/
      app/                    App shell and runtime effects
      integrations/           Better Auth, PostHog, and TanStack Query wiring
      lib/                     Cross-domain web infrastructure
      modules/<domain>/        Product features grouped by domain
      routes/                  Thin TanStack Router files
  mobile/
    src/
      app/                     Expo Router files
      global.css               Uniwind entrypoint
  api/
    src/
      app/                     Process boot, HTTP composition, and jobs
      adapters/<capability>/   Framework and provider boundaries
      config/                  Typed runtime configuration
      modules/<domain>/        Product behavior and public routes
      shared/<capability>/     Cross-domain server infrastructure
packages/
  db/                          Drizzle schema and migrations
  reader/                      Core, web, WebView, and native article rendering
  ui/                          Shared presentation primitives, icons, motion, and styles
  worker/                      Queue, ingestion, favicon, and sanitization contracts
  catalog/                     Optional offline Python catalog pipeline
  tsconfig/                    Shared compiler presets
tests/
  web/integration/src/         Vitest tree mirroring web ownership
  api/integration/             Bun test tree mirroring API and backend ownership
scripts/                       Repository automation grouped by capability
docker/                        Local infrastructure and shared environment defaults
```

Add `src/modules/<domain>` to mobile only when real product behavior exists. Keep Expo route files
thin and use the same domain-first ownership model as web; do not create empty architecture folders
for the current scaffold.

## Placement rules

1. Identify the current behavior owner and real consumers.
2. Keep app-local behavior inside its domain until another workspace needs a stable contract.
3. Put shared code in a package only when it has one coherent responsibility, explicit entrypoints,
   and real cross-workspace reuse.
4. Keep web and mobile route files focused on navigation, route inputs, loaders, and delegation.
5. Keep API boot and HTTP assembly focused on process wiring. Keep business behavior in
   `src/modules/<domain>`.
6. Put provider or framework protocol bridges in API adapters. Put reusable server behavior in
   `shared` only after more than one API domain owns the same responsibility.
7. Keep package exports intentional and minimal. An export is a compatibility surface.
8. Keep tests under `tests`, not beside production source. Mirror the owner and domain described in
   `$testing`.

## Growth inside domains

Start shallow. Add a directory when several files share a present sub-responsibility.

For web modules, use the established order when those responsibilities exist:

```text
modules/<domain>/
  components/<area>/
  hooks/
  layouts/
  lib/
  queries/
  page.tsx
```

Do not add every directory to every domain. Keep an area's primary component in `index.tsx` when the
directory already supplies its context. Put a web module's server functions in `lib/api.ts`. Web
modules depend on each other in one direction (`sidebar`, `settings`, `auth` -> `inbox` -> `reader`
-> `articles` -> `feeds`, `folders`, `preferences`); put shared domain code in the lowest owning
module instead of importing upward.

For API modules, group by product domain and then by behavior:

```text
modules/<domain>/
  <subdomain>/
  constants.ts
  types.ts
  schemas.ts
  queries.ts
  operations.ts
  service.ts
  routes.ts
```

Create only the roles the domain needs. Keep `routes.ts` as the HTTP boundary and delegator.

## Naming

- Use lowercase kebab-case for authored TypeScript and TSX files and directories.
- Preserve framework filenames such as `__root.tsx`, `_layout.tsx`, `$article.tsx`, route groups,
  dynamic segments, and generated `routeTree.gen.ts`.
- Keep React component and type symbols PascalCase. Keep functions and variables camelCase.
- Name a single-hook file `use-<purpose>.ts`; exported hooks always begin with `use`. A file that
  coordinates several domain hooks may use a responsibility name.
- Let directories carry repeated domain context. In web modules, keep source basenames to at most
  two semantic words when practical.
- Prefer responsibility names such as `routes`, `schemas`, `types`, `queries`, `operations`,
  `service`, `page`, `layout`, `cache`, `client`, or a precise domain term.
- Avoid generic `helpers.ts` or `utils.ts` when a more specific responsibility is available.
- Use `*.test.ts` and `*.test.tsx` for TypeScript tests. Name non-test fixtures and builders without
  `.test`.
- Use snake*case for Python modules and `test*\*.py` if Python tests are introduced.
- Keep directories shallow and do not use numeric prefixes to force display order.

### API naming

`apps/api` follows the general rules above plus the rules below. They are modeled on cal.com's
backend, where the directory carries the domain and the file name carries the role:
`apps/api/v2/src/modules/<domain>/{controllers,services,inputs,outputs,guards}` with
`<domain>.repository.ts`, and the tRPC `<procedure>.handler.ts` / `<procedure>.schema.ts` pairs
under `packages/trpc/server/routers/viewer/<domain>/`. Kyomi has no DI container or classes, so the
role is the basename (flat module directories, no `.controller.ts` suffix) and tests stay under
`tests/api`.

| Kyomi role file | cal.com analogue | Holds |
| --- | --- | --- |
| `routes.ts` | `*.controller.ts`, `_router.tsx` | Elysia HTTP boundary; validates, authenticates, delegates |
| `schemas.ts`, `types.ts` | `inputs/`, `outputs/`, `*.schema.ts` | TypeBox wire contracts; DTO types |
| `queries.ts` | `*.repository.ts` | Read-side SQL |
| `operations.ts`, `mutations.ts` | `services/`, `*.handler.ts` | Behavior and writes |
| `guard.ts`, `middleware.ts`, `plugin.ts` | `guards/`, `pipes/`, `decorators/` | Request interceptors and Elysia plugins |
| `client.ts`, `instance.ts`, provider name (`meili.ts`, `pino.ts`) | `prisma/`, `redis/` modules | Outbound connections, configured SDK instances, and provider adapters |

Rules:

1. Name the file for its role in the request or job path; use a precise domain term when no role
   word fits (`memberships.ts`, `cursor.ts`, `enrichment.ts`).
2. Use one word. The path already supplies the domain, so drop any word the directories say
   (`adapters/auth/otp.ts`, `shared/net/outbound.ts`, `app/jobs/health.ts`, `modules/opml/fetch.ts`).
   When two files in one directory would differ only by a qualifier, group them under a directory
   named for the shared noun and name each by its qualifier (`opml/cursor/failure.ts`,
   `opml/cursor/import.ts`) instead of hyphenating. A hyphenated basename needs a reason that a
   directory cannot carry.
3. Do not repeat the immediate parent directory (`adapters/auth/instance.ts`, not `auth/auth.ts`).
   Layer directories (`app`, `adapters`, `modules`, `shared`, `config`) are not domains and do not
   count.
4. Role words keep one meaning. `queries` is database reads, so querystring parsing is
   `params.ts`, not `query.ts`; `schemas` is TypeBox, so a file of TypeBox schemas is never
   `dto.ts`; avoid vague names such as `internal`, `stub`, `status`, `helpers`, `lib`, or `utils`
   when a function-specific word exists (`persistence.ts`, `params.ts`, `mark.ts`).
5. Do not wrap a single file in a directory (`recap/lib/types.ts` is `recap/types.ts`).
6. In `app/boot`, name process entrypoints for their role (`server`, `worker`, `scheduler`, `dev`)
   and operator scripts for one word of their `package.json` script key (`catalog:import` runs
   `import.ts`, `category:audit` runs `audit.ts`); the README maps each script to its file. Update
   `package.json`, the Dockerfile `CMD`, and compose commands together.
7. Keep tool-mandated or path-sensitive names: `config/env/runtime.ts`, `config/version.ts`
   (reads `../../package.json` relative to itself, so it stays in `src/config`), `src/index.ts`
   (the package `module` entry), and `index.ts` only where an adapter or area is an intentional
   surface.
8. Tests mirror the source path and basename
   (`tests/api/integration/<path under apps/api/src>/<basename>.test.ts`); behavior-spanning tests
   (`detail-tags`, `process-roles`, schema SQL checks) sit under their owning directory. A rename
   moves the mirror and updates `mock.module` strings, path-reading tests, and template imports in
   the same change.

Where API naming differs from web: no `use-*` hook files, no `index.tsx` primary-component files,
no `components/hooks/lib/layouts` directory tiers, and no enforced module-stack ordering (web's
`check:boundaries` tiers do not apply to API modules). API modules stay flat by role and are
isolated by the `modules/<domain>` boundary and the `adapters`/`shared` direction instead.

### Web naming

`apps/web` follows the general rules above plus the rules below. They are derived from cal.com's
`apps/web` (github.com/calcom/cal.com, now served from `calcom/cal.diy`; read 2026-10-18):
`modules/<domain>/{components,hooks,views,lib}` hold product behavior, `app/**` route files use
framework-mandated names (`page`, `layout`, `loading`, `error`, `route`) beside role files such as
`actions.ts` and `skeleton.tsx`, page-level client components are `<name>-view.tsx`, and `lib/`
files are named for what they do (`buildNonce`, `getThemeProviderProps`, `validateCsrfToken`,
`core/http/error/http-error.ts`).
cal.com spells components `PascalCase.tsx` and hooks `useCamelCase.ts`; Kyomi keeps kebab-case for
every authored file (`use-*.ts` hooks, lowercase component files) and keeps tests under `tests/web`
instead of beside source.

| Kyomi file | cal.com analogue | Holds |
| --- | --- | --- |
| `page.tsx`, `layout.tsx` | `modules/<domain>/*-view.tsx`, `app/**/layout.tsx` | A module's page entry and layout composition |
| `index.tsx` | `components/<Area>/index.tsx` | An area's primary component once its directory names it |
| `use-<purpose>.ts` | `hooks/use<Purpose>.ts` | One hook; the file names the purpose, the symbol carries the module |
| `api.ts` | `app/**/actions.ts` | `createServerFn` server functions and their client types |
| `options.ts`, `cache.ts` | none (Kyomi's TanStack Query layer) | Query options and cache mutations |
| `types.ts`, `constants.ts` | `types.ts`, `lib/constants.ts` | Shared types and constants for the directory |
| `-loader.ts`, `-component.tsx` | `lib/<route>/getServerSideProps.ts` | Route-adjacent files the router ignores (`-` prefix) |
| `hydration.ts`, `urls.ts`, a precise term | `lib/buildNonce.ts`, `lib/getThemeProviderProps.ts` | Named for the function the file performs |

Rules:

1. Name the file for what it does or the role it plays; a precise domain term beats a vague role
   word. Avoid `shared`, `helpers`, `utils`, `root`, or `functions` when a function-specific name
   exists (`headings.tsx`, `urls.ts`, `index.tsx`, `api.ts`).
2. Do not repeat the immediate parent directory or the owning module in a source basename
   (`app/shell.tsx`, `feeds/components/favicon.tsx`, `appearance/inbox.tsx`). Hook files are the
   exception: `use-<purpose>.ts` names the purpose even when the module name is part of the symbol
   (`preferences/hooks/use-preferences.ts`), and `sidebar/components/app-sidebar.tsx` keeps `app` to
   stay distinct from the `@kyomi/ui` sidebar primitive.
3. Keep basenames to about two semantic words (the `use-` prefix does not count); a third word is
   acceptable only to avoid a collision.
4. Role words keep one meaning. `queries/` is TanStack Query options, so a file that builds API
   URLs is `urls.ts`, not `query.ts`. Server functions live in `api.ts` (`lib/api.ts`,
   `lib/<area>/api.ts`), never in `functions.ts`.
5. Do not wrap a single file in a directory (`detail/blur.tsx`, not `detail/chrome/blur.tsx`) and do
   not use `index.ts` for a grab bag of constants unless the directory is an intentional surface
   (`inbox/lib/recap/index.ts`, `inbox/lib/layout/index.ts`, and `modules/auth/index.ts`).
6. Group files by capability, not by call site: query-client helpers live in `lib/query/`
   (`lib/query/hydration.ts`), auth helpers in `lib/auth/`.
7. Keep framework- and tool-mandated names: `routes/**` file names and `-` prefixed route-adjacent
   files, `routeTree.gen.ts`, `router.tsx`, `styles.css`, `katex.d.ts`, `vite.config.ts`, and the
   Start entry names. The service worker source is `service-worker.ts`; `vite.config.ts` reads it by
   path, so rename it together with `package.json` scripts.
8. Tests mirror the source path and basename
   (`tests/web/integration/src/<path under apps/web/src>/<basename>.test.ts(x)`). A rename moves the
   mirror in the same change and updates `vi.mock` and dynamic-import strings, `package.json`
   `reactDoctor` file overrides, and path mentions in docs and comments.
9. Do not add a `vi.mock` for a module path that does not exist; a stale mock silently stops
   mocking after a move.

## Imports and public surfaces

- Import shared code through `@kyomi/*` package exports, not `packages/*/src` paths.
- Do not import application source from packages.
- Use the aliases owned by each workspace; aliases do not change ownership.
- Import concrete paths across web domains instead of module-root barrels, and
  `check:boundaries` rejects module cycles and shared code that imports a module.
- Add `index.ts` only for a package entrypoint, a deliberate module surface, or an area's primary
  component. Do not add a barrel for one caller.

## Generated and platform artifacts

- Never edit `apps/web/src/routeTree.gen.ts` by hand.
- Generate Drizzle SQL and snapshots from the schema, then review and commit them with the behavior
  they support.
- Treat `dist`, `build`, `.output`, `.nitro`, `.tanstack`, `.turbo`, `node_modules`, coverage,
  catalog exports, caches, and virtual environments as outputs, not architecture.
- Edit `apps/mobile/ios` or `apps/mobile/android` only for a concrete native requirement. Keep
  Expo configuration and JavaScript ownership authoritative when no platform-specific change is
  needed.

## Review checklist

- Can a contributor identify the owner from the path?
- Is the route, boot, or composition file still thin?
- Does every new directory represent current behavior?
- Do dependencies flow from apps to package exports?
- Are package entrypoints explicit and backed by real consumers?
- Do tests mirror the owner and domain?
- Were generated artifacts changed through their owning generator?
- Did a move update imports, exports, tests, documentation, and the old path together?
