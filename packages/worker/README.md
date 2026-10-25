# @kyomi/worker

queue contracts, feed ingestion, favicon resolution, and the ingest-time article compiler. consumed by background jobs and both apps.

## layout

```text
src/
  services/
    queue/    Redis Stream job contracts and consumers.
    feed/     feed fetch, parse, enrich, and refresh.
    favicon/  SSRF-safe favicon resolution and browser proxy URLs.
  document/      ingest-time article compiler and its passes (Node-only, linkedom).
  lib/           article identity, HTML entities, and feed helpers.
```

## exports

| import                               | purpose                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `@kyomi/worker`                      | queue, feed, favicon, and helpers.                                                 |
| `@kyomi/worker/queue`                | job stream types and consumers.                                                                  |
| `@kyomi/worker/ingestion`            | feed refresh and parsing.                                                                        |
| `@kyomi/worker/document`             | `compileArticleDocument` (HTML plus KDM), `compileArticleHtml`, and the ordered compiler passes. |
| `@kyomi/worker/favicon`              | server-side favicon fetch and resolution.                                                        |
| `@kyomi/worker/favicon/browser`      | client favicon proxy URL builder.                                                                |
| `@kyomi/worker/lib/article-identity` | article URL identity helpers.                                                                    |
| `@kyomi/worker/lib/html-entities`    | HTML entity decoding.                                                                            |

## commands

| command                                   | purpose           |
| ----------------------------------------- | ----------------- |
| `bun run --cwd packages/worker typecheck` | type-check.       |
| `bun run --cwd packages/worker lint`      | lint.             |
| `bun run --cwd packages/worker fmt:check` | check formatting. |

## notes

- `apps/api` owns the executable `worker` and `scheduler` processes.
- refresh and OPML jobs use separate streams so imports don't starve scheduled refreshes.
- Article HTML policy and sanitizer live in `@kyomi/reader/sanitization` (browser-safe); `document` imports
  it plus the KDM schema from `@kyomi/reader/document`. Reader never imports worker.
- `document` runs once at ingest. Read paths re-apply only the `@kyomi/reader/sanitization` policy, because the
  compiler's first pass strips `data-kyomi-*` hints it did not write itself.
