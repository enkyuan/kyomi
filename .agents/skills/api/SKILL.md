---
name: api
description: Build, refactor, review, or debug Kyomi backend code in apps/api. Use for Elysia HTTP composition, domain routes and operations, adapters for auth, database, logging, Redis, queues, search, CORS, rate limits, and OpenAPI, typed runtime configuration, worker and scheduler process boot, health behavior, outbound network policy, database-backed product behavior, queue publishing, catalog import, and API or backend tests. Use when deciding whether code belongs in an API domain, app composition, an adapter, shared server infrastructure, packages/db, or packages/worker. Not for frontend-only or final repository-wide verification work.
---

# API

Keep product behavior domain-owned, HTTP boundaries thin, and executable processes in the app.

## Establish context

1. Read `AGENTS.md`, `apps/api/README.md`, the relevant boot or HTTP composition file, the owning
   module, its adapters or packages, and the closest tests.
2. Load `$architecture` before moving ownership, adding a process or package entrypoint, or changing
   a public or internal contract.
3. Load `$packages` for schema, migration, queue, ingestion, sanitization, or package-export changes.
4. Add `$security`, `$environment`, and `$testing` for their boundaries.

## Organize the API

```text
apps/api/src/
  app/
    boot/                    server, worker, scheduler, and dev entrypoints plus operator scripts
    http/                    Elysia construction and route registration
    jobs/                    Executable job orchestration
    setup/                   Process-wide setup and lifecycle
  adapters/<capability>/     Framework and provider protocol boundaries
  config/env/                Typed runtime configuration
  modules/<domain>/          Product behavior, schemas, operations, and routes
  shared/<capability>/       Cross-domain errors, HTTP, network, and text
```

- Keep boot and HTTP assembly focused on wiring and lifecycle.
- Keep public product behavior under `src/modules/<domain>`. Split large domains by subdomain or
  read/write responsibility before creating repository-wide technical buckets.
- Keep each `routes.ts` file as the HTTP boundary and delegator. Put schemas, types, queries,
  operations, and services beside the domain that owns them.
- Put provider or framework bridges in `adapters/<capability>`. Inject adapters into behavior that
  must be tested without a live dependency.
- Put code in `shared` only when multiple API domains own the same server responsibility. Prefer a
  precise capability name over generic helpers.

## Name files

The directory carries the domain; the basename states the file's role in the request or job path.
The full rule set, its cal.com analogue, and the differences from web naming live in
[repository-organization.md](../architecture/references/repository-organization.md#api-naming).

- Use a single lowercase word and a role name: `routes.ts` (HTTP boundary), `schemas.ts` (TypeBox
  wire contracts), `types.ts` (DTO types), `queries.ts` (read SQL), `operations.ts` or
  `mutations.ts` (behavior and writes), `guard.ts`, `middleware.ts`, `plugin.ts`, `client.ts`,
  `handler.ts` (single Request-to-Response handler), `constants.ts`, or a precise domain term.
  The path supplies the rest (`adapters/auth/otp.ts`, `shared/net/outbound.ts`).
- When two files would differ only by a qualifier, group them in a directory named for the shared
  noun (`opml/cursor/failure.ts`, `opml/cursor/import.ts`) instead of hyphenating.
- Name a provider adapter after its provider (`meili.ts`, `pino.ts`) or its role (`instance.ts`).
- Do not repeat the immediate parent directory (`adapters/auth/instance.ts`, not `auth/auth.ts`).
  Avoid vague names such as `internal`, `stub`, `status`, `helpers`, or `lib`. Never use `query`
  for querystring parsing (`params.ts`) or `dto` for TypeBox schemas (`schemas.ts`).
- Name `app/boot` process entrypoints for their role (`server`, `worker`, `scheduler`, `dev`) and
  operator scripts for one word of their package script key (`catalog:import` runs `import.ts`).
  Keep `package.json`, the Dockerfile `CMD`, and compose commands in sync when one moves.
- Keep directories shallow until a subdomain has multiple responsibilities; do not wrap one file in
  a directory.
- Add `index.ts` only for an intentional adapter or package-like surface.
- Keep tests mirroring the renamed path and basename (`tests/api/integration/<src path>/<basename>.test.ts`)
  and update `mock.module` strings and path-reading tests with the move.
- Keep imports ordered from platform and third-party dependencies to workspace aliases to relative
  files.

## Preserve server boundaries

- Keep Drizzle schema and migrations in `packages/db`; keep product queries, tenant scoping, and
  authorization in the owning API module.
- Keep queue contracts, feed ingestion, favicon resolution, and shared sanitization in
  `packages/worker`. Keep API, worker, and scheduler entrypoints in `apps/api/src/app/boot`.
- Import packages through `@kyomi/*` exports, never package source paths.
- Validate request and response shapes at the HTTP boundary. Return stable status-specific public
  errors.
- Authenticate and authorize every user-owned read or mutation at the server boundary.
- Give outbound requests finite time, size, redirect, and retry policies. Reuse `shared/net`
  protections for untrusted URLs and preserve caller cancellation.
- Keep secrets server-side and parse runtime values in `src/config/env/runtime.ts`.
- Keep `apps/api/src/modules/feeds/routes.ts` a delegator; put refresh enqueue behavior under
  `modules/feeds/refresh`.

## Verify

1. Put tests under `tests/api/integration` and mirror the app or backend owner. Do not add tests under
   `apps/api`.
2. Cover success, invalid input, absent or unauthorized identity, provider failure, timeout, retry,
   cancellation, and duplicate work when relevant.
3. Run the narrowest Bun test through the API dotenvx environment.
4. Run `bun run --cwd apps/api typecheck`, `lint`, and `fmt:check`.
5. Run migration drift, worker/package checks, or production process checks when their contracts
   changed.
6. Finish through `$qa`.
