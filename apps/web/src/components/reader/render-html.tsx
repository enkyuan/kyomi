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

export const RenderHtml = memo(function RenderHtml({ html }: { html: string }) {
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
});
