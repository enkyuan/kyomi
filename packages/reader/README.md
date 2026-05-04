# `@cronos/reader`

Shared reader package for Cronos.

- `@cronos/reader/core`: platform-neutral types and helpers
- `@cronos/reader/web`: browser rendering for `apps/web`
- `@cronos/reader/webview`: pure HTML document generation for mobile WebViews
- `@cronos/reader/native`: thin React wrapper around the WebView document layer

Fetching, route state, inbox layout, and settings persistence stay outside this package.
