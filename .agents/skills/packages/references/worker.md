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
  document/         Node-only ingest compiler and its passes (linkedom)
  lib/              Article identity, safe URLs, entities, and feed text
```

## Rules

- Keep executable worker and scheduler boot in `apps/api/src/app/boot`.
- Keep queue payload parsing and compatibility in `services/queue`; validate at consumption.
- Keep feed lifecycle and network policy under `services/feed`; preserve finite resource and
  per-host limits.
- Keep server-side favicon fetching separate from the browser-safe proxy URL export.
- Keep `sanitization` browser-safe. Do not import Redis, database, queue, JSDOM, or API modules.
  `document` may import `sanitization`, never the reverse.
- Compile untrusted article bodies once, at ingest, with `compileArticleDocument` (HTML plus the
  validated KDM document; async because Shiki loads grammars lazily) or `compileArticleHtml` when
  only HTML is needed. Read paths re-apply only
  the policy; never run compiler passes on stored HTML, because pass 2 strips the compiler's own
  `data-kyomi-*` hints.
- Changing the policy or a pass's output bumps `ARTICLE_HTML_SANITIZER_VERSION` and needs a
  recorded corpus baseline (`tests/api/fixtures/articles/corpus/README.md`).
- Import only `@kyomi/reader/document` from `@kyomi/reader`; the edge is a peer dependency because
  reader imports `@kyomi/worker/sanitization` (Turborepo would otherwise report a cycle).
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
