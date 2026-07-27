# Worker package

Use `packages/worker` for reusable queue, feed-ingestion, favicon, and sanitization contracts.

## Structure

```text
src/
  services/
    queue/          Redis Stream job types, parsing, and consumers
    feed/           Fetch, parse, enrich, classify, and refresh behavior
    favicon/        SSRF-safe resolution and browser proxy URLs
  sanitization/     Browser-safe article HTML policy
  lib/              Article identity, safe URLs, entities, and feed text
```

## Rules

- Keep executable worker and scheduler boot in `apps/api/src/app/boot`.
- Keep queue payload parsing and compatibility in `services/queue`; validate at consumption.
- Keep feed lifecycle and network policy under `services/feed`; preserve finite resource and
  per-host limits.
- Keep server-side favicon fetching separate from the browser-safe proxy URL export.
- Keep `sanitization` browser-safe. Do not import Redis, database, queue, JSDOM, or API modules.
- Never import `apps/api` internals from this package.
- Export only stable contracts through declared `@kyomi/worker` subpaths.
- Preserve job compatibility deliberately during producer/consumer rollouts. Define retirement
  conditions for legacy fields or job types.

## Tests and checks

- Test queue and process orchestration under `tests/api/integration/app/jobs` or
  `tests/api/integration/modules/queue`.
- Test feed and favicon behavior under the owning API integration domain.
- Test browser-safe exported behavior through the web suite when the web app consumes it.
- Run `bun run --cwd packages/worker typecheck`, `lint`, and `fmt:check`, plus focused API tests.
