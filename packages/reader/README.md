# @cronos/reader

Shared reader types, WebView HTML generation, and optional React **web** UI.

## Peer / runtime dependencies

| Package | When needed |
|--------|----------------|
| `react`, `react-dom` | Importing `@cronos/reader/web` (React components). |
| `@base-ui/react` | Link preview UI inside `@cronos/reader/web`. |

`@cronos/reader/core` and `@cronos/reader/webview` do not import React.

HTML sanitization in `@cronos/reader/web` (`sanitizeReaderArticleHtml` → DOMPurify) runs **only in the browser** (a real `window`). That keeps the Vite client bundle free of Node-only modules such as `node:module` / `jsdom`. For server-side or script sanitization, use `@cronos/sanitization` with an appropriate DOM implementation in your app.
