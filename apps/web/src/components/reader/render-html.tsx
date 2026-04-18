"use client";

import DOMPurify from "dompurify";
import { memo } from "react";
import "katex/dist/katex.min.css";

/**
 * Client-side DOMPurify configuration.
 *
 * Even though the API sanitizes HTML server-side, this provides a defense-in-depth
 * boundary so the client never blindly renders untrusted markup via dangerouslySetInnerHTML.
 */
const ALLOWED_TAGS = [
  "a",
  "article",
  "blockquote",
  "br",
  "code",
  "details",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "main",
  "mark",
  "ol",
  "p",
  "pre",
  "section",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "abbr",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
  // KaTeX elements
  "math",
  "semantics",
  "mrow",
  "mi",
  "mo",
  "mn",
  "msup",
  "msub",
  "mfrac",
  "mover",
  "munder",
  "msqrt",
  "mtext",
  "annotation",
];

const ALLOWED_ATTR = [
  "href",
  "rel",
  "target",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "loading",
  "colspan",
  "rowspan",
  "scope",
  "class",
  // KaTeX attributes
  "style",
  "aria-hidden",
  "encoding",
  "xmlns",
  "mathvariant",
];

function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}

function normalizeCaptionText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeFigureCaptionSpacing(value: string): string {
  return value
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Many publishers repeat the same string in `img[alt]` and `<figcaption>`.
 * When both match, clear `alt` so the caption is the single visible description
 * and screen readers are not given duplicate announcements. If the image fails to
 * load, the figcaption still describes the figure.
 */
function normalizeFigureContent(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }
  if (!html.includes("<figure") && !html.includes("<img")) {
    return html;
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  for (const figure of tpl.content.querySelectorAll("figure")) {
    const cap = figure.querySelector("figcaption");
    if (!cap) {
      continue;
    }
    const normalizedCaption = normalizeFigureCaptionSpacing(cap.textContent ?? "");
    cap.textContent = normalizedCaption;
    const capNorm = normalizeCaptionText(normalizedCaption);
    if (!capNorm) {
      continue;
    }
    for (const img of figure.querySelectorAll("img")) {
      // Keep reader image sizing consistent; ignore publisher pixel constraints.
      img.removeAttribute("width");
      img.removeAttribute("height");
      const altNorm = normalizeCaptionText(img.getAttribute("alt") ?? "");
      if (altNorm && altNorm === capNorm) {
        img.setAttribute("alt", "");
      }
    }
  }

  for (const img of tpl.content.querySelectorAll("img")) {
    img.removeAttribute("width");
    img.removeAttribute("height");
  }

  return tpl.innerHTML;
}

/**
 * When markdown uses inline backticks around a literal `<code>…</code>` fragment
 * (e.g. `` `<code>AllocationRecord</code>` ``), marked emits one outer `<code>` whose
 * text is the entity-encoded tags. Readers then see visible `<code>…</code>` inside
 * the code span. Collapse that to a single inline code with the inner text only.
 */
function unwrapRedundantInlineCodeMarkup(html: string): string {
  return html
    .replace(/<code>&lt;code&gt;([\s\S]*?)&lt;\/code&gt;<\/code>/gi, "<code>$1</code>")
    .replace(/<code><code>([\s\S]*?)<\/code><\/code>/gi, "<code>$1</code>");
}

function prepareArticleHtml(html: string): string {
  const normalized = unwrapRedundantInlineCodeMarkup(html);
  const safe = sanitizeHtml(normalized);
  return normalizeFigureContent(safe);
}

export const RenderHtml = memo(function RenderHtml({ html }: { html: string }) {
  return (
    <div
      className="article-body"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: prepareArticleHtml(html) }}
    />
  );
});
