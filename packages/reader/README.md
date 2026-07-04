# @kyomi/reader

article rendering shared by the web and native clients.

## layout

```text
src/
  core/          reader types and pure helpers.
  sanitization/  browser-safe article HTML policy.
  web/           React components, HTML rendering, and styles.
  webview/       WebView HTML generation.
  native/        native reader entry points.
  shared/        helpers used by more than one entry point.
```

## exports

| import | purpose |
| --- | --- |
| `@kyomi/reader` | reader types and helpers. |
| `@kyomi/reader/core` | explicit core entry point. |
| `@kyomi/reader/sanitization` | article sanitization policy. |
| `@kyomi/reader/web` | React web reader and HTML rendering. |
| `@kyomi/reader/web/styles.css` | web reader styles. |
| `@kyomi/reader/webview` | WebView HTML generation. |
| `@kyomi/reader/native` | native reader entry point. |

## commands

| command | purpose |
| --- | --- |
| `bun run --cwd packages/reader typecheck` | type-check. |
| `bun run --cwd packages/reader lint` | lint. |
| `bun run --cwd packages/reader fmt:check` | check formatting. |

## notes

- `core` and `webview` must not import React.
- `web` expects React as a peer dependency.
- `sanitization` must stay browser-safe — no JSDOM or Node-only modules.
