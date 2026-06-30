# @kyomi/reader

Shared reader types, WebView HTML generation, and optional React **web** UI.

## Peer / runtime dependencies

| Package | When needed |
|--------|----------------|
| `react`, `react-dom` | Importing `@kyomi/reader/web` (React components). |
| `@base-ui/react` | Link preview UI inside `@kyomi/reader/web`. |

`@kyomi/reader/core` and `@kyomi/reader/webview` do not import React.

HTML sanitization in `@kyomi/reader/web` (`sanitizeReaderArticleHtml` → DOMPurify) runs **only in the browser** (a real `window`). That keeps the Vite client bundle free of Node-only modules such as `node:module` / `jsdom`. For server-side or script sanitization, use `@kyomi/worker/sanitization` with an appropriate DOM implementation in your app.
