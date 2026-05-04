export function getReaderWebViewStyles() {
  return `
    :root {
      color-scheme: light dark;
      --reader-bg: #f7f5f2;
      --reader-fg: #171717;
      --reader-muted: rgba(23, 23, 23, 0.64);
      --reader-border: rgba(23, 23, 23, 0.12);
      --reader-code-bg: rgba(23, 23, 23, 0.06);
    }
    body {
      margin: 0;
      padding: 0;
      background: var(--reader-bg);
      color: var(--reader-fg);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .reader-root {
      padding: 20px 16px 32px;
      font-size: var(--reader-font-size, 17px);
      line-height: 1.65;
    }
    .reader-root img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 0 auto;
      border-radius: 8px;
    }
    .reader-root pre,
    .reader-root code {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
    }
    .reader-root pre {
      overflow-x: auto;
      padding: 14px;
      border-radius: 10px;
      background: var(--reader-code-bg);
    }
    .reader-root blockquote {
      margin: 16px 0;
      padding-left: 14px;
      border-left: 3px solid var(--reader-border);
      color: var(--reader-muted);
    }
    .reader-root .reader-fallback,
    .reader-root .reader-notice {
      color: var(--reader-muted);
    }
  `;
}
