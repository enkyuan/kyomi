---
name: packages
description: Build, refactor, review, or debug Kyomi shared packages. Use for Drizzle schema and migrations in packages/db; shared article contracts and web, WebView, or native rendering in packages/reader; reusable UI primitives, icons, motion, and styles in packages/ui; queue, feed ingestion, favicon, and sanitization contracts in packages/worker; the optional Python catalog pipeline in packages/catalog; or compiler presets in packages/tsconfig. Use for package exports, cross-workspace reuse, runtime compatibility, dependency direction, package-specific tests, and deciding whether code should remain app-local. Pair with the owning app skill when a package contract changes a consumer.
---

# Packages

Keep each package cohesive, runtime-safe, and exposed through the smallest public surface.

## Select the owner

Read only the reference for the package being changed:

| Package             | Responsibility                         | Reference                                 |
| ------------------- | -------------------------------------- | ----------------------------------------- |
| `packages/db`       | Drizzle schema and migrations          | [database.md](references/database.md)     |
| `packages/reader`   | Shared article contracts and renderers | [reader.md](references/reader.md)         |
| `packages/ui`       | Shared presentation system             | [ui.md](references/ui.md)                 |
| `packages/worker`   | Queue and ingestion contracts          | [worker.md](references/worker.md)         |
| `packages/catalog`  | Optional offline Python enrichment     | [catalog.md](references/catalog.md)       |
| `packages/tsconfig` | Shared compiler presets                | [typescript.md](references/typescript.md) |

Load `$architecture` before creating a package, moving code from an app, changing dependency
direction, or adding a public entrypoint whose owner is unclear.

## Preserve package boundaries

- Give one package one coherent responsibility. Keep product composition and app-specific behavior
  in the owning app.
- Never import application source from a package.
- Import packages through declared `@kyomi/*` exports. Do not reach through `/src` or relative paths
  across workspace boundaries.
- Treat every subpath export as a compatibility surface. Export only what real consumers need.
- Keep runtime-specific entrypoints separate. Do not make browser-safe, native, worker, or Node-only
  entrypoints import incompatible dependencies.
- Use lowercase kebab-case for TypeScript files and directories and snake_case for Python.
- Group source by domain or runtime responsibility, not by speculative layers.
- Keep tests under the repository `tests` workspace and use the runner that owns the behavior.
- Update the package README when its contract, entrypoints, setup, or extension layout changes.

## Change a package

1. Inspect the package manifest, exports, TypeScript or Python configuration, closest source, real
   consumers, and tests.
2. Decide whether the behavior is truly shared. Keep it app-local when only one domain owns it.
3. Change the implementation and public entrypoint together. Update all consumers without adding
   permanent forwarding aliases unless compatibility requires them.
4. Add `$security` for sanitization, untrusted URLs, persistence, auth, or provider boundaries.
5. Add `$design` for UI, reader presentation, motion, or shared style changes.
6. Use `$testing` to place regression and contract coverage under the correct web or API tree.
7. Run the package's format, lint, and typecheck scripts plus focused consumer tests and builds.
8. Finish through `$qa`.
