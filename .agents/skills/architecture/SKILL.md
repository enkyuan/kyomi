---
name: architecture
description: Evaluate, design, review, or implement Kyomi architecture and repository-organization changes. Use when deciding where code belongs; adding, moving, renaming, extracting, or removing an app, package, domain module, process, public entrypoint, shared contract, runtime, or major dependency; changing dependency direction, data ownership, environment ownership, generated-artifact handling, or test ownership; or auditing filesystem structure and naming across apps, packages, tests, scripts, and Docker. Use before owner skills when placement or ownership is ambiguous. Not for routine edits that clearly follow an established boundary.
---

# Architecture

Keep ownership visible in the filesystem and make the smallest boundary change that solves the
present need.

## Establish context

1. Read `AGENTS.md`, `docs/repo-layout.md`, the nearest workspace README, affected manifests,
   package exports, aliases, and representative tests.
2. Inspect current callers, consumers, runtime flow, data flow, configuration, and generated
   artifacts. Do not infer architecture from directory names alone.
3. Read [repository-organization.md](references/repository-organization.md) before adding, moving,
   renaming, sharing, or reviewing files, directories, modules, tests, or package entrypoints.
4. If the owner and placement are already clear, stop architectural expansion and use `$web`,
   `$mobile`, `$api`, or `$packages`.

## Decide ownership

1. Keep deployable products and process entrypoints under `apps/<name>`.
2. Keep reusable libraries, runtime-neutral contracts, and shared tooling under `packages/<name>`.
   Do not create a package for hypothetical reuse.
3. Keep product behavior in domain modules. Keep route, boot, and composition files focused on
   wiring, validation, metadata, and delegation.
4. Keep packages independent of application source. Cross workspace boundaries through declared
   dependencies and package exports, never deep source paths.
5. Choose the owner before choosing a framework or directory. Name who owns behavior, data,
   configuration, failure handling, tests, and public compatibility.
6. Define migration, rollback, generated outputs, verification, and removal of transitional paths
   when the boundary changes.

## Preserve Kyomi invariants

- Keep `apps/web`, `apps/mobile`, and `apps/api` independently runnable.
- Keep PostgreSQL schema and migrations in `packages/db`; keep product queries and authorization in
  the owning API domain.
- Keep feed ingestion, queue contracts, favicon resolution, and shared sanitization in
  `packages/worker`; keep executable worker and scheduler processes in `apps/api`.
- Keep reusable presentation primitives and dependencies in `packages/ui`, and shared article
  rendering in `packages/reader`.
- Keep `packages/catalog` optional and offline. Normal application setup must not require Python,
  uv, or catalog synchronization.
- Keep compiler presets in `packages/tsconfig`; keep aliases and environment types in consumers.
- Prefer concrete cross-domain imports over broad barrels that create cycles.
- Add directories only for present responsibilities. Preserve framework-mandated and generated
  filenames instead of renaming them to fit a generic convention.

## Route implementation

- Use `$web`, `$mobile`, or `$api` for app-owned implementation.
- Use `$packages` and its exact package reference for shared-package work.
- Add `$testing` when behavior or a test boundary changes.
- Add `$environment` or `$security` when configuration or a trust boundary changes.
- Add `$design` for user-facing interface decisions.
- Finish through `$qa`.

Report confirmed repository facts separately from proposed decisions. Include the chosen owner,
changed contracts, rejected alternatives, migration and rollback path, and verification surface.
