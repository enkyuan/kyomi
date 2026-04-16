import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

// Create a DOMPurify instance using JSDOM's window for server-side usage.
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

/**
 * DOMPurify-based article HTML sanitizer.
 *
 * Replaces the previous hand-rolled JSDOM walker with a battle-tested
 * sanitization library. Configured to:
 * - Allow only article-safe structural tags
 * - Strip all event handlers, style attributes, and dangerous URI schemes
 * - Allow safe link/image attributes and code language classes
 * - Remove interactive/chrome elements entirely (forms, nav, buttons, etc.)
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
];

const ALLOWED_ATTR = [
  // Links
  "href",
  "rel",
  "target",
  // Images
  "src",
  "alt",
  "title",
  "width",
  "height",
  "loading",
  // Tables
  "colspan",
  "rowspan",
  "scope",
  // Code highlighting
  "class",
];

/**
 * Tags that should be removed entirely (including their children), not
 * just unwrapped. These are interactive/chrome elements that have no
 * place in article content.
 */
const FORBID_TAGS = [
  "aside",
  "button",
  "footer",
  "form",
  "header",
  "iframe",
  "input",
  "nav",
  "noscript",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
];

// Configure DOMPurify once
DOMPurify.setConfig({
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  FORBID_TAGS,
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^https?:\/\//i,
});

// Hook: only allow `class` attribute on `code` elements with a language- pattern
DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  if (data.attrName === "class") {
    if (node.tagName?.toLowerCase() !== "code" || !/^language-[\w-]+$/.test(data.attrValue)) {
      data.keepAttr = false;
    }
  }
});

// Hook: remove empty elements (except void elements)
const VOID_ELEMENTS = new Set(["br", "hr", "img"]);
DOMPurify.addHook("afterSanitizeElements", (node) => {
  if (
    node.nodeType === 1 &&
    !VOID_ELEMENTS.has((node as Element).tagName.toLowerCase()) &&
    !(node as Element).hasChildNodes() &&
    !node.textContent?.trim()
  ) {
    node.parentNode?.removeChild(node);
  }
});

export function sanitizeArticleHtml(html: string): string {
  const clean = DOMPurify.sanitize(html);
  return clean.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Strip all HTML tags and produce plain text. Inserts newlines at block
 * boundaries for readability.
 */
export function htmlToText(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;

  for (const element of document.querySelectorAll("br")) {
    element.replaceWith("\n");
  }

  for (const element of document.querySelectorAll(
    "p, li, blockquote, pre, h1, h2, h3, h4, h5, h6, tr",
  )) {
    element.append("\n");
  }

  return document.body.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";
}
