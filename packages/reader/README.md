# @kyomi/reader

Shared reader primitives for article rendering across web and native Kyomi surfaces.

## Layout

```text
src/
  core/          Shared reader types and pure helpers.
  sanitization/  Browser-safe article HTML policy.
  web/           React web components, HTML rendering, and styles.
  webview/       WebView HTML generation.
  native/        Native reader entry points.
  shared/        Internal helpers shared by entry points.
```

## Exports

| Import | Purpose |
| --- | --- |
| `@kyomi/reader` | Core reader types and helpers. |
| `@kyomi/reader/core` | Explicit core entry point. |
| `@kyomi/reader/sanitization` | Shared article sanitization policy. |
| `@kyomi/reader/web` | React web reader UI and HTML rendering. |
| `@kyomi/reader/web/styles.css` | Web reader styles. |
| `@kyomi/reader/webview` | WebView HTML generation. |
| `@kyomi/reader/native` | Native reader entry point. |

## Commands

| Command | Purpose |
| --- | --- |
| `bun run --cwd packages/reader typecheck` | Type-check the package. |
| `bun run --cwd packages/reader lint` | Lint source. |
| `bun run --cwd packages/reader fmt:check` | Check formatting. |

## Notes

- `@kyomi/reader/core` and `@kyomi/reader/webview` must not import React.
- `@kyomi/reader/web` expects React peer dependencies.
- Browser sanitization must stay browser-safe and free of JSDOM or other Node-only modules.
