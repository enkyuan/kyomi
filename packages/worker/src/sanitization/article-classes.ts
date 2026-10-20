/** Class-token filtering for article HTML: keep layout and semantic hints, drop page chrome. */

/** Elements that may carry filtered `class` tokens (plus `code`, handled separately). */
const CLASS_CAPABLE_TAGS = new Set([
  "div",
  "section",
  "article",
  "aside",
  "footer",
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
