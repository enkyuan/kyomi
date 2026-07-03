# @kyomi/worker

Shared queue contracts, feed ingestion, favicon resolution, and article sanitization used by Kyomi background jobs and apps.

## Layout

```text
src/
  services/
    queue/    Redis Stream job contracts and consumers.
    feed/     Feed fetch, parse, enrich, and refresh helpers.
    favicon/  SSRF-safe favicon resolution and browser proxy URL helpers.
  sanitization/  Shared article HTML policy.
  lib/           Article identity, HTML entities, and feed helpers.
```

## Exports

| Import | Purpose |
| --- | --- |
| `@kyomi/worker` | Main queue, feed, favicon, sanitization, and helper exports. |
| `@kyomi/worker/queue` | Job stream types and consumers. |
| `@kyomi/worker/ingestion` | Feed refresh and parsing helpers. |
| `@kyomi/worker/sanitization` | Browser-safe article HTML policy and sanitizer. |
| `@kyomi/worker/favicon` | Server-side favicon fetch and resolution. |
| `@kyomi/worker/favicon/browser` | Client favicon proxy URL builder. |
| `@kyomi/worker/lib/article-identity` | Article URL identity helpers. |
| `@kyomi/worker/lib/html-entities` | HTML entity decoding helper. |

## Commands

| Command | Purpose |
| --- | --- |
| `bun run --cwd packages/worker typecheck` | Type-check the package. |
| `bun run --cwd packages/worker lint` | Lint source. |
| `bun run --cwd packages/worker fmt:check` | Check formatting. |

## Notes

- `apps/api` owns executable `worker` and `scheduler` process boots.
- Refresh and OPML jobs use separate streams so imports do not starve scheduled refreshes.
- `@kyomi/worker/sanitization` must stay browser-safe; do not import Redis, database, queue, or JSDOM modules from that subpath.
