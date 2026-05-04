import type { ReaderContent, ReaderLayoutMode, ReaderPreferences } from "../core";
import { normalizeSafeHttpUrl } from "../core";
import { getReaderWebViewBridgeScript } from "./bridge-script";
import { getReaderWebViewStyles } from "./styles";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeBodyText(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function renderReaderBody(reader: ReaderContent): string {
  if (reader.bodyKind === "html") {
    return reader.contentHtml ?? "";
  }
  if (reader.bodyKind === "markdown") {
    return `<pre>${escapeHtml(reader.contentMarkdown ?? "")}</pre>`;
  }
  if (reader.bodyKind === "text") {
    return `<div>${escapeBodyText(reader.contentText ?? "")}</div>`;
  }

  const notice = reader.notice
    ? `<p class="reader-notice">${escapeBodyText(reader.notice)}</p>`
    : "";
  const summary = reader.fallbackSummary
    ? `<p class="reader-fallback">${escapeBodyText(reader.fallbackSummary)}</p>`
    : "";
  return `${notice}${summary}`;
}

function createBaseTag(baseUrl?: string | null) {
  const normalized = baseUrl ? normalizeSafeHttpUrl(baseUrl) : null;
  return normalized ? `<base href="${escapeHtml(normalized)}">` : "";
}

export function createReaderDocument({
  reader,
  preferences,
  layoutMode = "normalized",
}: {
  reader: ReaderContent;
  preferences?: Partial<ReaderPreferences>;
  layoutMode?: ReaderLayoutMode;
}) {
  const fontSizePx = preferences?.fontSizePx ?? 17;
  const hideImages = preferences?.showImages === false;
  const body = renderReaderBody(reader);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    ${createBaseTag(reader.contentBaseUrl)}
    <style>
      ${getReaderWebViewStyles()}
      .reader-root { --reader-font-size: ${fontSizePx}px; }
      ${hideImages ? ".reader-root img, .reader-root figure { display: none !important; }" : ""}
      ${layoutMode === "fidelity" ? ".reader-root figure { margin-inline: auto; }" : ""}
    </style>
  </head>
  <body>
    <main class="reader-root" data-reader-layout-mode="${layoutMode}">
      ${body}
    </main>
    <script>${getReaderWebViewBridgeScript()}</script>
  </body>
</html>`;
}
