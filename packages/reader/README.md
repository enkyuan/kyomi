# @kyomi/reader

article rendering shared by the web and native clients.

## layout

```text
src/
  core/          reader types and pure helpers; document/ holds the document model schema.
  sanitization/  browser-safe article HTML policy.
  web/           React components, HTML rendering, and styles.
  webview/       WebView HTML generation.
  native/        native reader entry points.
  shared/        helpers used by more than one entry point.
```

## exports

| import                         | purpose                                    |
| ------------------------------ | ------------------------------------------ |
| `@kyomi/reader`                | reader types and helpers.                  |
| `@kyomi/reader/core`           | explicit core entry point.                 |
| `@kyomi/reader/document`       | Kyomi Document Model Zod schema and types. |
| `@kyomi/reader/sanitization`   | article HTML policy and sanitizer.              |
| `@kyomi/reader/web`            | React web reader and HTML rendering.       |
| `@kyomi/reader/web/styles.css` | web reader styles.                         |
| `@kyomi/reader/webview`        | WebView HTML generation.                   |
| `@kyomi/reader/native`         | native reader entry point.                 |

## commands

| command                                   | purpose           |
| ----------------------------------------- | ----------------- |
| `bun run --cwd packages/reader typecheck` | type-check.       |
| `bun run --cwd packages/reader lint`      | lint.             |
| `bun run --cwd packages/reader fmt:check` | check formatting. |

## notes

- `core` and `webview` must not import React.
- `web` expects React as a peer dependency.
- `sanitization` must stay browser-safe — no JSDOM or Node-only modules. It owns the article HTML policy shared by web, API, and the worker compiler; `packages/reader` must never import `@kyomi/worker`.
- article HTML is compiled once at ingest by `@kyomi/worker/document`. the web renderer re-applies
  the policy only and reads the compiler's hints instead of re-deriving them: `pre[data-kyomi-lang]`
  and `[data-kyomi-filename]` label code blocks, `figure[data-kyomi-embed][data-kyomi-url]` marks
  an embed, `li[data-kyomi-checked]` carries task-list state, and `#kyomi-*` links are in-page.
- `transformImageUrl` receives every image request (`src`, each `srcset` candidate, `video[poster]`).
  returning `null` keeps the original URL; a non-http result drops it. media files are not
  transformed.
