import { ARTICLE_HTML_PURIFY_CONFIG, registerArticleHtmlSanitizeHooks } from "@cronos/sanitization";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

// Create a DOMPurify instance using JSDOM's window for server-side usage.
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

registerArticleHtmlSanitizeHooks(DOMPurify);
DOMPurify.setConfig(ARTICLE_HTML_PURIFY_CONFIG);

/**
 * DOMPurify-based article HTML sanitizer (see `@cronos/sanitization`).
 *
 * Configured to:
 * - Allow article-safe structural tags including `div` for publisher layout
 * - Filter `class` tokens to layout/content patterns; `code` keeps `language-*` only
 * - Strip inline `style` except on KaTeX spans and MathML (DOMPurify still validates CSS)
 * - Strip event handlers and dangerous URI schemes
 * - Remove interactive/chrome elements entirely (forms, nav, buttons, etc.)
 */

function normalizeSafeHttpUrl(raw: string, baseUrl?: string | null): string | null {
  const candidate = raw.trim();
  if (!candidate) {
    return null;
  }
  try {
    const parsed = new URL(candidate, baseUrl ?? undefined);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveRelativeAssetUrls(html: string, baseUrl?: string | null): string {
  if (!baseUrl) {
    return html;
  }
  const root = normalizeSafeHttpUrl(baseUrl);
  if (!root) {
    return html;
  }
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;

  for (const link of document.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (!href) {
      continue;
    }
    const normalized = normalizeSafeHttpUrl(href, root);
    if (normalized) {
      link.setAttribute("href", normalized);
    } else {
      link.removeAttribute("href");
    }
  }

  for (const img of document.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src");
    if (!src) {
      continue;
    }
    const normalized = normalizeSafeHttpUrl(src, root);
    if (normalized) {
      img.setAttribute("src", normalized);
    } else {
      img.removeAttribute("src");
    }
  }

  return document.body.innerHTML;
}

/**
 * Carousel / slider control class-name substrings that flag a `<ul>/<ol>` for removal.
 * We only strip when the list *also* matches structural heuristics (see below).
 */
const CAROUSEL_CLASS_RE =
  /carousel|slider|slick|swiper|glide|dots?|indicator|pagination|pager|nav-thumb|slideshow|owl/i;

/**
 * Returns `true` when `text` looks like a single pagination marker:
 * - empty / whitespace-only
 * - single unicode bullet / circle / dot / digit
 * - a bare number like "1", "2", "10"
 */
function isSingleDotOrIndex(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // Single bullet / dot / circle character
  if (/^[•●○◦◼◻■□▪▫–—·‣⬤\u2022\u25CF\u25CB]$/.test(t)) return true;
  // Bare number (slide index)
  if (/^\d{1,3}$/.test(t)) return true;
  return false;
}

/**
 * Strips carousel/slider pagination artifacts from sanitized HTML.
 *
 * Heuristics (must be satisfied together):
 * 1. The `<ul>/<ol>` carries a class matching CAROUSEL_CLASS_RE, **or**
 * 2. Every `<li>` in the list contains only a single dot/bullet/number/empty text.
 *
 * This avoids stripping legitimate article lists.
 */
function stripCarouselArtifacts(html: string): string {
  if (!html.includes("<li")) return html;
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;
  let changed = false;

  for (const list of document.querySelectorAll("ul, ol")) {
    const items = list.querySelectorAll(":scope > li");
    if (items.length === 0) {
      // Empty list — remove
      list.remove();
      changed = true;
      continue;
    }

    const hasCarouselClass = CAROUSEL_CLASS_RE.test(list.className ?? "");
    const allDots = Array.from(items).every((li) => isSingleDotOrIndex(li.textContent ?? ""));

    // For <ol>, bare numbers ("1","2","3") are legitimate — only strip if class signals carousel
    if (list.tagName === "OL" && !hasCarouselClass) continue;

    if (hasCarouselClass || allDots) {
      list.remove();
      changed = true;
    }
  }

  return changed ? document.body.innerHTML : html;
}

function normalizeMetadataText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function looksLikeRelativeOrDateline(text: string): boolean {
  const compact = text.trim().replace(/\s+/g, " ");
  if (!compact) {
    return false;
  }
  if (
    /^\d+\s+(?:sec|secs|second|seconds|min|mins|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago$/i.test(
      compact,
    )
  ) {
    return true;
  }
  if (
    /^(?:updated\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s+\d{4})?$/i.test(
      compact,
    )
  ) {
    return true;
  }
  if (/^[A-Z][a-z]+,\s+[A-Z][a-z]+\s+\d{1,2}(?:,\s+\d{4})?$/.test(compact)) {
    return true;
  }
  return false;
}

function looksLikePersonName(text: string): boolean {
  const compact = text.trim().replace(/\s+/g, " ");
  if (!compact || compact.length > 60) {
    return false;
  }
  const words = compact.split(" ");
  if (words.length < 2 || words.length > 4) {
    return false;
  }
  return words.every((word) => /^[A-Z][a-zA-Z.'-]+$/.test(word));
}

const GENERIC_WRAPPER_TAGS = new Set(["DIV", "SECTION", "ARTICLE", "MAIN"]);

function hasOnlyWhitespaceTextNodes(element: Element): boolean {
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === node.TEXT_NODE && !(node.textContent ?? "").trim()) {
      continue;
    }
    if (node.nodeType === node.ELEMENT_NODE) {
      continue;
    }
    return false;
  }
  return true;
}

function descendToContentRoot(element: HTMLElement): HTMLElement {
  let current = element;
  while (
    GENERIC_WRAPPER_TAGS.has(current.tagName) &&
    current.childElementCount === 1 &&
    hasOnlyWhitespaceTextNodes(current)
  ) {
    const child = current.firstElementChild;
    if (!(child instanceof current.ownerDocument.defaultView!.HTMLElement)) {
      break;
    }
    current = child;
  }
  return current;
}

function firstMeaningfulDirectChild(parent: HTMLElement): HTMLElement | null {
  for (const child of Array.from(parent.children)) {
    if (!(child instanceof parent.ownerDocument.defaultView!.HTMLElement)) {
      continue;
    }
    const text = normalizeMetadataText(child.textContent);
    if (text || child.querySelector("img, figure, table, pre, ul, ol, blockquote")) {
      return child;
    }
  }
  return null;
}

function resolveDirectChildBlock(root: HTMLElement, node: HTMLElement): HTMLElement {
  let current: HTMLElement = node;
  while (current.parentElement && current.parentElement !== root) {
    current = current.parentElement;
  }
  return current;
}

function isTitleLikeBlock(
  root: HTMLElement,
  title: string,
): { heading: HTMLElement; block: HTMLElement } | null {
  const heading = root.querySelector<HTMLElement>("h1, h2, h3");
  if (!heading) {
    return null;
  }

  const block = resolveDirectChildBlock(root, heading);
  const firstChild = firstMeaningfulDirectChild(root);
  if (!firstChild || firstChild !== block) {
    return null;
  }

  const headingText = normalizeMetadataText(heading.textContent);
  const blockText = normalizeMetadataText(block.textContent);
  const titleMatches =
    headingText === title ||
    headingText.includes(title) ||
    title.includes(headingText) ||
    blockText === title;

  if (!titleMatches) {
    return null;
  }

  if (block.querySelector("img, figure, table, pre, ul, ol, blockquote")) {
    return null;
  }

  const wordCount = blockText.split(/\s+/).filter(Boolean).length;
  if (wordCount > 30) {
    return null;
  }

  return { heading, block };
}

function isMetadataOnlyBlock(
  block: HTMLElement,
  metadata: { byline: string; excerpt: string },
): boolean {
  if (block.querySelector("img, figure, table, pre, ul, ol, blockquote, h1, h2, h3")) {
    return false;
  }

  const text = (block.textContent ?? "").trim();
  const normalized = normalizeMetadataText(text);
  if (!normalized) {
    return true;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount > 40) {
    return false;
  }

  const matchesByline =
    Boolean(metadata.byline) &&
    (normalized === metadata.byline ||
      normalized.includes(metadata.byline) ||
      metadata.byline.includes(normalized));
  const matchesExcerpt =
    Boolean(metadata.excerpt) &&
    (normalized === metadata.excerpt ||
      normalized.includes(metadata.excerpt) ||
      metadata.excerpt.includes(normalized));

  return (
    matchesByline ||
    matchesExcerpt ||
    looksLikeRelativeOrDateline(text) ||
    /^by\s+/i.test(text) ||
    looksLikePersonName(text)
  );
}

function stripLeadingArticleMetadata(
  html: string,
  metadata?: { title?: string | null; byline?: string | null; excerpt?: string | null },
): string {
  const normalizedTitle = normalizeMetadataText(metadata?.title);
  if (!normalizedTitle) {
    return html;
  }

  const normalizedByline = normalizeMetadataText(metadata?.byline);
  const normalizedExcerpt = normalizeMetadataText(metadata?.excerpt);
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;
  let root: HTMLElement = document.body;
  const bodyFirstChild = document.body.firstElementChild;
  if (
    document.body.childElementCount === 1 &&
    bodyFirstChild instanceof dom.window.HTMLElement &&
    GENERIC_WRAPPER_TAGS.has(bodyFirstChild.tagName)
  ) {
    root = descendToContentRoot(bodyFirstChild);
  }
  const titleBlock = isTitleLikeBlock(root, normalizedTitle);
  if (!titleBlock) {
    return html;
  }
  titleBlock.block.remove();

  let removedMetadataCount = 0;
  let cursor = firstMeaningfulDirectChild(root);
  while (cursor && removedMetadataCount < 4) {
    if (!isMetadataOnlyBlock(cursor, { byline: normalizedByline, excerpt: normalizedExcerpt })) {
      break;
    }

    const next = cursor.nextElementSibling as HTMLElement | null;
    cursor.remove();
    removedMetadataCount += 1;
    cursor = next;
  }

  return document.body.innerHTML;
}

export function sanitizeArticleHtml(
  html: string,
  options?: {
    baseUrl?: string | null;
    title?: string | null;
    byline?: string | null;
    excerpt?: string | null;
  },
): string {
  const normalized = resolveRelativeAssetUrls(html, options?.baseUrl);
  const clean = DOMPurify.sanitize(normalized);
  const withoutCarousel = stripCarouselArtifacts(clean);
  const withoutRedundantLeadingMetadata = stripLeadingArticleMetadata(withoutCarousel, {
    title: options?.title,
    byline: options?.byline,
    excerpt: options?.excerpt,
  });
  return withoutRedundantLeadingMetadata.replace(/\n{3,}/g, "\n\n").trim();
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
    "p, li, blockquote, pre, h1, h2, h3, h4, h5, h6, tr, div, section, article, main",
  )) {
    element.append("\n");
  }

  return document.body.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";
}
