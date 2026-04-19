import type { Config, DOMPurify, NodeHook, UponSanitizeAttributeHook } from "dompurify";

/**
 * Shared DOMPurify policy for article HTML (server + client).
 *
 * Goals:
 * - Preserve structural wrappers (e.g. div-based author cards, figures, callouts)
 * - Allow conservative `class` tokens for layout/semantics; keep code `language-*`
 * - Strip interactive/page chrome, scripts, and dangerous URLs
 * - Restrict inline `style` to MathML + spans (KaTeX); rely on tags/classes elsewhere
 */

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

/** Removed entirely with children (interactive / chrome / active content). */
export const ARTICLE_HTML_FORBID_TAGS = [
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

function filterClassAttr(tag: string, value: string): string | null {
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

const registeredPurify = new WeakSet<object>();

/** Instance returned by `createDOMPurify(window)` or `DOMPurify` in the browser. */
export type ArticleHtmlPurifyInstance = DOMPurify;

const uponSanitizeArticleAttributes: UponSanitizeAttributeHook = function (_node, data) {
  const tag = _node.tagName?.toLowerCase() ?? "";
  const attrLower = data.attrName.toLowerCase();
  /* TypeDoc / documentation builds emit data-tsd-* (e.g. source paths); never keep in reader HTML. */
  if (attrLower === "data-tsd-source" || attrLower.startsWith("data-tsd-")) {
    data.keepAttr = false;
    return;
  }
  if (data.attrName === "class") {
    const next = filterClassAttr(tag, data.attrValue);
    if (next === null) {
      data.keepAttr = false;
    } else {
      data.attrValue = next;
    }
    return;
  }
  if (data.attrName === "style") {
    if (!STYLE_ALLOWED_TAGS.has(tag)) {
      data.keepAttr = false;
      return;
    }
    if (!data.attrValue?.trim()) {
      data.keepAttr = false;
    }
    return;
  }
};

const removeEmptyElements: NodeHook = function (currentNode) {
  if (
    currentNode.nodeType === 1 &&
    !VOID_ELEMENTS.has((currentNode as Element).tagName.toLowerCase()) &&
    !(currentNode as Element).hasChildNodes() &&
    !(currentNode as Element).textContent?.trim()
  ) {
    currentNode.parentNode?.removeChild(currentNode);
  }
};

export function registerArticleHtmlSanitizeHooks(purify: ArticleHtmlPurifyInstance): void {
  if (registeredPurify.has(purify as object)) {
    return;
  }
  registeredPurify.add(purify as object);

  purify.addHook("uponSanitizeAttribute", uponSanitizeArticleAttributes);
  purify.addHook("afterSanitizeElements", removeEmptyElements);
}

export const ARTICLE_HTML_PURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [...ARTICLE_HTML_ALLOWED_TAGS],
  ALLOWED_ATTR: [...ARTICLE_HTML_ALLOWED_ATTR],
  FORBID_TAGS: [...ARTICLE_HTML_FORBID_TAGS],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^https?:\/\//i,
};

/** Options object for `DOMPurify.sanitize(html, opts)` (client). */
export function getArticleHtmlSanitizeOptions(): Config {
  return { ...ARTICLE_HTML_PURIFY_CONFIG };
}
