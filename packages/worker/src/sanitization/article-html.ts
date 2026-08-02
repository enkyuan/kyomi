import { Sanitizer, type PolicyInput } from "neosanitize";

/**
 * Shared article HTML policy for server + browser reader sanitization.
 *
 * Goals:
 * - Preserve structural wrappers (e.g. div-based author cards, figures, callouts)
 * - Allow conservative `class` tokens for layout/semantics; keep code `language-*`
 * - Strip interactive/page chrome, scripts, and dangerous URLs
 * - Restrict inline `style` to MathML + spans (KaTeX); rely on tags/classes elsewhere
 */

/**
 * Increment whenever the allowlist, drop-content tags, attribute/class/URL/style rules,
 * image defaults, or empty-element normalization changes output semantics. A persisted
 * row's stored version is compared against this to decide whether a fresh sanitizer pass
 * is required before it can be treated as already-safe.
 */
export const ARTICLE_HTML_SANITIZER_VERSION = "article-html-v1" as const;

export const ARTICLE_HTML_ALLOWED_TAGS = [
  "a",
  "article",
  "blockquote",
  "br",
  "code",
  "details",
  "div",
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
  // KaTeX / MathML
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
] as const;

export const ARTICLE_HTML_ALLOWED_ATTR = [
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
  // KaTeX / MathML
  "style",
  "aria-hidden",
  "encoding",
  "xmlns",
  "mathvariant",
] as const;

/** Tags removed by policy because they are active content or publisher chrome. */
export const ARTICLE_HTML_DROP_CONTENT_TAGS = [
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
] as const;

/** Backward-compatible policy name for callers that treat these as forbidden tags. */
export const ARTICLE_HTML_FORBID_TAGS = ARTICLE_HTML_DROP_CONTENT_TAGS;

const VOID_ELEMENTS = new Set(["br", "hr", "img"]);

/** Elements that may carry filtered `class` tokens (plus `code`, handled separately). */
const CLASS_CAPABLE_TAGS = new Set([
  "div",
  "section",
  "article",
  "main",
  "span",
  "figure",
  "figcaption",
  "p",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "em",
  "strong",
  "abbr",
  "mark",
  "details",
  "summary",
  "sub",
  "sup",
  "a",
  "img",
  "pre",
]);

/** Whole-token denylist (lowercase). */
const DENIED_CLASS_TOKENS = new Set([
  "ad",
  "ads",
  "advert",
  "banner",
  "carousel",
  "chrome",
  "cookie",
  "cookies",
  "dots",
  "drawer",
  "footer",
  "gdpr",
  "glide",
  "header",
  "indicator",
  "indicators",
  "menu",
  "modal",
  "nav",
  "navigation",
  "newsletter",
  "pagination",
  "pager",
  "popup",
  "promo",
  "sharebar",
  "sidebar",
  "slick",
  "slider",
  "slideshow",
  "sponsored",
  "subscribe",
  "swiper",
  "toolbar",
  "widget",
]);

const MATH_TAGS = new Set([
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
]);

const STYLE_ALLOWED_TAGS = new Set<string>(["span", ...Array.from(MATH_TAGS)]);
const HTTP_URL_ATTRS = ["href", "src"] as const;

/**
 * Prefixes for publisher/layout classes we intentionally keep (author cards, figures, CMS).
 * Matching is case-insensitive; token must equal, start with `prefix-`, or start with `prefix__` (BEM).
 */
const ARTICLE_CLASS_PREFIXES = [
  "author",
  "avatar",
  "bio",
  "byline",
  "callout",
  "caption",
  "card",
  "citation",
  "content",
  "contributor",
  "deck",
  "entry",
  "epigraph",
  "figure",
  "flex",
  "float",
  "grid",
  "group",
  "highlight",
  "info",
  "inner",
  "kicker",
  "layout",
  "lead",
  "mark",
  "media",
  "meta",
  "metadata",
  "name",
  "note",
  "outer",
  "panel",
  "photo",
  "picture",
  "post",
  "prose",
  "pullquote",
  "quote",
  "role",
  "row",
  "social",
  "stack",
  "subtitle",
  "text",
  "time",
  "tip",
  "title",
  "updated",
  "well",
  "wrap",
  "article",
  "published",
  "align",
  "col",
  "wp",
  "has",
  "wp-block",
  "katex",
] as const;

const MICROFORMAT_CLASS = /^(?:h|p|u|dt|e)-[a-zA-Z0-9](?:[a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;

/** Gutenberg / WordPress block classes and alignment helpers. */
const WORDPRESSISH_CLASS =
  /^(?:wp|has)-[a-zA-Z0-9][a-zA-Z0-9_-]*$|^align(?:left|right|center|wide|full)$/;

const ARTICLE_HTML_POLICY = {
  tags: ARTICLE_HTML_ALLOWED_TAGS,
  attrs: {
    "*": ARTICLE_HTML_ALLOWED_ATTR,
  },
} satisfies PolicyInput;

const articleHtmlSanitizer = Sanitizer.builder(ARTICLE_HTML_POLICY).build();

function matchesArticlePrefix(lower: string): boolean {
  for (const prefix of ARTICLE_CLASS_PREFIXES) {
    if (lower === prefix) {
      return true;
    }
    if (lower.startsWith(`${prefix}-`) || lower.startsWith(`${prefix}__`)) {
      return true;
    }
  }
  return false;
}

export function isAllowedArticleClassToken(token: string): boolean {
  const t = token.trim();
  if (!t || t.length > 64) {
    return false;
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(t)) {
    return false;
  }
  const lower = t.toLowerCase();
  if (DENIED_CLASS_TOKENS.has(lower)) {
    return false;
  }
  if (MICROFORMAT_CLASS.test(t)) {
    return true;
  }
  if (WORDPRESSISH_CLASS.test(t)) {
    return true;
  }
  if (/^language-[\w-]+$/.test(t)) {
    return true;
  }
  if (/^katex(?:-|$)/i.test(t)) {
    return true;
  }
  if (matchesArticlePrefix(lower)) {
    return true;
  }
  return false;
}

export function filterArticleClassAttr(tag: string, value: string): string | null {
  const lowerTag = tag.toLowerCase();
  if (lowerTag === "code") {
    const kept = value
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => /^language-[\w-]+$/.test(t));
    return kept.length > 0 ? kept.join(" ") : null;
  }
  if (!CLASS_CAPABLE_TAGS.has(lowerTag)) {
    return null;
  }
  const kept = value
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && isAllowedArticleClassToken(t));
  return kept.length > 0 ? kept.join(" ") : null;
}

function isSafeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function normalizeElementAttributes(element: Element): void {
  const tag = element.tagName.toLowerCase();

  for (const attr of Array.from(element.attributes)) {
    const attrLower = attr.name.toLowerCase();
    /* TypeDoc / documentation builds emit data-tsd-* (e.g. source paths); never keep in reader HTML. */
    if (attrLower === "data-tsd-source" || attrLower.startsWith("data-tsd-")) {
      element.removeAttribute(attr.name);
    }
  }

  for (const attr of HTTP_URL_ATTRS) {
    const value = element.getAttribute(attr);
    if (value && !isSafeHttpUrl(value)) {
      element.removeAttribute(attr);
    }
  }

  const classValue = element.getAttribute("class");
  if (classValue !== null) {
    const next = filterArticleClassAttr(tag, classValue);
    if (next === null) {
      element.removeAttribute("class");
    } else {
      element.setAttribute("class", next);
    }
  }

  const styleValue = element.getAttribute("style");
  if (styleValue !== null) {
    if (!STYLE_ALLOWED_TAGS.has(tag) || !styleValue.trim()) {
      element.removeAttribute("style");
    }
  }

  if (tag === "img") {
    if (!element.hasAttribute("loading")) {
      element.setAttribute("loading", "lazy");
    }
    if (!element.hasAttribute("decoding")) {
      element.setAttribute("decoding", "async");
    }
  }
}

function removeEmptyElements(root: ParentNode): void {
  const elements = Array.from(root.querySelectorAll("*")).reverse();
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    if (!VOID_ELEMENTS.has(tag) && !element.hasChildNodes() && !element.textContent?.trim()) {
      element.parentNode?.removeChild(element);
    }
  }
}

export function sanitizeArticleHtmlFragment(html: string): string {
  return articleHtmlSanitizer.sanitize(html);
}

export function normalizeSanitizedArticleRoot(root: ParentNode): void {
  for (const element of Array.from(root.querySelectorAll("*"))) {
    normalizeElementAttributes(element);
  }
  removeEmptyElements(root);
}
