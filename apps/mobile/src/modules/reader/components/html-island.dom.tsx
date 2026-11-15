"use dom";

import { useMemo, type CSSProperties } from "react";
import type { DOMProps } from "expo/dom";
import { sanitizeArticleHtmlFragment } from "@kyomi/reader/sanitization";
// KaTeX with its fonts inlined: the exported WebView bundle does not ship `fonts/KaTeX_*.woff2`.
import "@kyomi/reader/web/katex-offline.css";
import "@kyomi/reader/web/styles.css";
import "@kyomi/ui/styles/reader.css";

const DEFAULT_EMBED_ASPECT_RATIO = 16 / 9;

type HtmlIslandProps = {
  readonly kind: "html" | "math" | "embed";
  readonly html?: string;
  readonly frameUrl?: string;
  readonly aspectRatio?: number;
  readonly colorScheme: "dark" | "light";
  readonly fontSizePx: number;
  readonly title: string;
  readonly dom?: DOMProps;
};

/**
 * WebView island for the three things native text cannot express: `html` escape-hatch blocks,
 * KaTeX output and third-party players. HTML is re-sanitized here because this runs in a web
 * context; embeds load only compiler-built allowlist URLs.
 */
export default function HtmlIsland({
  aspectRatio = DEFAULT_EMBED_ASPECT_RATIO,
  colorScheme,
  fontSizePx,
  frameUrl,
  html,
  kind,
  title,
}: HtmlIslandProps) {
  const safeHtml = useMemo(
    () => (kind === "embed" || !html ? "" : sanitizeArticleHtmlFragment(html)),
    [html, kind],
  );
  const dark = colorScheme === "dark";
  const style = {
    "--reader-font-size": `${fontSizePx}px`,
    background: "transparent",
    color: dark ? "#f7f7f7" : "#303030",
    colorScheme: dark ? "dark" : "light",
    // A block formatting context keeps `.katex-display`'s vertical margin inside the measured
    // body, so the WebView height (a ResizeObserver on `<body>`) includes tall formulas whole.
    display: "flow-root",
    margin: 0,
    minWidth: 0,
    overflowX: "auto",
  } as CSSProperties;

  if (kind === "embed" && frameUrl) {
    return (
      <div style={{ ...style, aspectRatio: String(aspectRatio), width: "100%" }}>
        <iframe
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          src={frameUrl}
          style={{ border: 0, height: "100%", width: "100%" }}
          title={title}
        />
      </div>
    );
  }

  return (
    <div className="reader-content" style={style}>
      {/* The native block gap already spaces equations, so drop KaTeX's own display margin. */}
      {kind === "math" ? <style>{".reader-content .katex-display{margin:0}"}</style> : null}
      <div className="article-body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </div>
  );
}
