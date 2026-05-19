# @vols.rss/reader

Shared reader types, WebView HTML generation, and optional React **web** UI.

## Peer / runtime dependencies

| Package | When needed |
|--------|----------------|
| `react`, `react-dom` | Importing `@vols.rss/reader/web` (React components). |
| `@base-ui/react` | Link preview UI inside `@vols.rss/reader/web`. |

`@vols.rss/reader/core` and `@vols.rss/reader/webview` do not import React.

HTML sanitization in `@vols.rss/reader/web` (`sanitizeReaderArticleHtml` → DOMPurify) runs **only in the browser** (a real `window`). That keeps the Vite client bundle free of Node-only modules such as `node:module` / `jsdom`. For server-side or script sanitization, use `@vols.rss/sanitization` with an appropriate DOM implementation in your app.
