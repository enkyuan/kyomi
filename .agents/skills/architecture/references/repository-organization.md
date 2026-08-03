# Kyomi repository organization

Use these rules when adding, moving, renaming, or reviewing source and test files. Preserve current
Kyomi paradigms before applying general preferences.

## Contents

- [Repository map](#repository-map)
- [Placement rules](#placement-rules)
- [Growth inside domains](#growth-inside-domains)
- [Naming](#naming)
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
  services/
  utils/
  page.tsx
  index.ts
```

Do not add every directory to every domain. Keep an area's primary component in `index.tsx` when the
directory already supplies its context. Use module-root barrels only as intentional public surfaces.

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

## Imports and public surfaces

- Import shared code through `@kyomi/*` package exports, not `packages/*/src` paths.
- Do not import application source from packages.
- Use the aliases owned by each workspace; aliases do not change ownership.
- Prefer concrete paths across web domains when a barrel would create feeds, inbox, sidebar, or
  reader cycles.
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
