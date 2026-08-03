# Reader package

Use `packages/reader` for article contracts and rendering shared by web and native clients.

## Structure

```text
src/
  core/            Pure types, settings, language, and URL helpers
  sanitization/    Browser-safe article HTML policy
  shared/          Helpers used by more than one runtime entrypoint
  web/             React web components, DOM enhancement, and styles
  webview/         WebView document and bridge generation
  native/          Native reader entrypoint and styles
```

## Runtime rules

- Keep `core` and `webview` independent of React.
- Keep `sanitization` browser-safe; do not import JSDOM, Redis, database, queue, or Node-only code.
- Keep DOM and React code behind the `web` entrypoint.
- Keep React Native code behind the `native` entrypoint.
- Share code through `shared` only when more than one runtime entrypoint consumes it.
- Preserve explicit `@kyomi/reader` subpath exports; do not make consumers deep-import source.

## Article behavior

- Inspect article DOM conservatively and add explicit `data-*` markers for enhancement.
- Avoid broad structural selectors such as `:has(...)` when they can match whole-article wrappers.
- Trust explicit fence or `language-*` and `lang-*` hints for code highlighting. Do not aggressively
  auto-detect unknown snippets.
- Keep reader preference preview and persistence on one synchronized value path.
- Keep the vanilla DOM copy control class `reader-code-copy-button`, with ghost styling and
  concentric radii in reader styles rather than a shadcn button.

## Tests and checks

- Put web renderer and app-integration tests under `tests/web/integration/src/modules/reader` or a
  direct package contract tree under `tests/web/integration/src/packages/reader`.
- Add native or WebView coverage only through a runner capable of exercising that boundary.
- Run `bun run --cwd packages/reader typecheck`, `lint`, and `fmt:check`, plus focused consumers.
