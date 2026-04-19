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

export function sanitizeArticleHtml(
  html: string,
  options?: {
    baseUrl?: string | null;
  },
): string {
  const normalized = resolveRelativeAssetUrls(html, options?.baseUrl);
  const clean = DOMPurify.sanitize(normalized);
  const withoutCarousel = stripCarouselArtifacts(clean);
  return withoutCarousel.replace(/\n{3,}/g, "\n\n").trim();
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
