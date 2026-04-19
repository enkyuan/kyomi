"use client";

import {
  getArticleHtmlSanitizeOptions,
  registerArticleHtmlSanitizeHooks,
} from "@cronos/sanitization";
import DOMPurify from "dompurify";
import { cn } from "@lib/utils";
import { skeletonShimmerClassName } from "@components/ui/skeleton";
import { enhanceArticleCodeBlocks } from "./article-code-blocks";
import "katex/dist/katex.min.css";

registerArticleHtmlSanitizeHooks(DOMPurify);

/**
 * Client-side DOMPurify configuration aligned with `@cronos/sanitization`.
 *
 * Even though the API sanitizes HTML server-side, this provides a defense-in-depth
 * boundary so the client never blindly renders untrusted markup via dangerouslySetInnerHTML.
 */
function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, getArticleHtmlSanitizeOptions());
}

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
  if (!baseUrl || typeof document === "undefined") {
    return html;
  }
  const normalizedBase = normalizeSafeHttpUrl(baseUrl);
  if (!normalizedBase) {
    return html;
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = html;

  for (const link of tpl.content.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (!href) {
      continue;
    }
    const normalized = normalizeSafeHttpUrl(href, normalizedBase);
    if (normalized) {
      link.setAttribute("href", normalized);
    } else {
      link.removeAttribute("href");
    }
  }

  for (const image of tpl.content.querySelectorAll("img[src]")) {
    const src = image.getAttribute("src");
    if (!src) {
      continue;
    }
    const normalized = normalizeSafeHttpUrl(src, normalizedBase);
    if (normalized) {
      image.setAttribute("src", normalized);
    } else {
      image.removeAttribute("src");
    }
  }

  return tpl.innerHTML;
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

function prepareArticleHtml(html: string, baseUrl?: string | null): string {
  const normalized = unwrapRedundantInlineCodeMarkup(html);
  const withResolvedUrls = resolveRelativeAssetUrls(normalized, baseUrl);
  const safe = sanitizeHtml(withResolvedUrls);
  return normalizeFigureContent(safe);
}

const READER_IMG_FRAME = "data-reader-img-frame";
/** Applied to author / CMS wrappers so image+text stay side-by-side (see styles.css). */
const READER_MEDIA_ASIDE = "data-reader-media-aside";
/** Small portrait / avatar: float + max-width (see styles.css); avoids full-bleed author headshots. */
const READER_PROFILE_THUMB = "data-reader-profile-thumb";
/** Marks a text block as an image caption (not inside a `<figure>`). */
const READER_FIGURE_CAPTION = "data-reader-figure-caption";
/** Marks a text block as a photo/image credit line. */
const READER_FIGURE_CREDIT = "data-reader-figure-credit";

/** Avoid treating a whole article wrapper (hero image + many blocks) as a single media row. */
const MEDIA_ASIDE_MAX_DIRECT_CHILDREN = 8;

function isMediaLeadingElement(el: Element): boolean {
  if (el.matches(`[${READER_IMG_FRAME}]`)) {
    return true;
  }
  if (el.tagName === "FIGURE" && el.querySelector(`img, [${READER_IMG_FRAME}]`)) {
    return true;
  }
  if (el.tagName === "A" && el.querySelector(`[${READER_IMG_FRAME}]`)) {
    return true;
  }
  return false;
}

function markReaderMediaAsideElement(el: HTMLElement): void {
  if (el.closest(`[${READER_MEDIA_ASIDE}]`)) {
    return;
  }
  el.setAttribute(READER_MEDIA_ASIDE, "");
}

/**
 * Only rows that look like “thumbnail + one text column” get aside layout.
 * We never use pure CSS `:has(> img:first-child)` on arbitrary divs: a wrapper whose first
 * child is the article hero but whose other children are many `<p>` tags would become a flex
 * row of columns and destroy reading width.
 */
function markReaderMediaAsideLayouts(container: HTMLElement): void {
  const classHints = container.querySelectorAll<HTMLElement>(
    [
      ".wp-block-media-text",
      ":is(div, section, article).author-bio",
      ":is(div, section, article).media-object",
    ].join(","),
  );
  for (const el of classHints) {
    const n = el.children.length;
    if (n < 2 || n > MEDIA_ASIDE_MAX_DIRECT_CHILDREN) {
      continue;
    }
    if (!isMediaLeadingElement(el.children[0]!)) {
      continue;
    }
    markReaderMediaAsideElement(el);
  }

  const structuralHosts = container.querySelectorAll<HTMLElement>(":is(div, section, article)");
  for (const el of structuralHosts) {
    if (el.closest(`[${READER_MEDIA_ASIDE}]`)) {
      continue;
    }
    if (el.children.length !== 2) {
      continue;
    }
    const first = el.children[0]!;
    const second = el.children[1]!;
    if (!isMediaLeadingElement(first)) {
      continue;
    }
    const secondTag = second.tagName;
    /* Hero + lede is often frame + <p>; only pair with block wrappers likely to be bios / CMS columns. */
    if (secondTag !== "DIV" && secondTag !== "SECTION" && secondTag !== "ARTICLE") {
      continue;
    }
    markReaderMediaAsideElement(el);
  }
}

const PROFILE_IMG_CLASS_RE =
  /avatar|headshot|profile|photo|gravatar|author-img|authorimage|contributor|columnist/i;

/** Broader author-block host detection. */
function isLikelyAuthorBlockHost(frame: HTMLElement): boolean {
  return Boolean(
    frame.closest(
      [
        ".author-bio",
        ".media-object",
        ".byline",
        ".wp-block-author",
        "[class*='author-bio']",
        "[class*='author-box']",
        "[class*='author-card']",
        "[class*='contributor']",
        "[class*='bio-wrapper']",
        "[class*='byline-block']",
        "[class*='profile']",
      ].join(", "),
    ),
  );
}

/** Regex matching text content that strongly suggests an author/bio block. */
const AUTHOR_TEXT_RE =
  /\b(?:is a (?:reporter|journalist|writer|editor|correspondent|columnist|contributor|analyst|producer|author))|(?:has (?:written|reported|covered) (?:about|on|for))|(?:(?:editor|author|contributor|columnist|reporter|correspondent) (?:at|for|of)\b)|(?:lives in\b)|(?:follow (?:them|her|him|me) on\b)/i;

function tryMarkProfileThumb(
  frame: HTMLElement,
  img: HTMLImageElement,
  orderedFrames: HTMLElement[],
): void {
  if (frame.closest(`[${READER_MEDIA_ASIDE}]`)) {
    return;
  }
  if (frame.hasAttribute(READER_PROFILE_THUMB)) {
    return;
  }

  const viaClass = PROFILE_IMG_CLASS_RE.test(img.className ?? "");
  const viaHost = isLikelyAuthorBlockHost(frame);
  const isLastFrame = orderedFrames.length > 0 && orderedFrames[orderedFrames.length - 1] === frame;

  // Check if adjacent text has author-like content (broadens detection beyond class/host)
  const viaAdjacentText = (() => {
    const parent = frame.parentElement;
    if (!parent) return false;
    let cursor = frame.nextElementSibling ?? parent.nextElementSibling;
    for (let i = 0; i < 3 && cursor; i++) {
      const text = (cursor.textContent ?? "").trim();
      if (text && AUTHOR_TEXT_RE.test(text)) return true;
      cursor = cursor.nextElementSibling;
    }
    return false;
  })();

  if (viaClass || viaHost || viaAdjacentText) {
    frame.setAttribute(READER_PROFILE_THUMB, "");
    return;
  }

  const applyIntrinsic = (): void => {
    if (frame.hasAttribute(READER_PROFILE_THUMB) || frame.closest(`[${READER_MEDIA_ASIDE}]`)) {
      return;
    }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w > 0 && h > 0 && isLastFrame && orderedFrames.length >= 2) {
      const maxD = Math.max(w, h);
      const minD = Math.min(w, h);
      /* Tail portrait when publisher omits classes; skip single-image articles (could be a small hero) */
      if (maxD <= 520 && minD > 0 && maxD / minD < 2.75) {
        frame.setAttribute(READER_PROFILE_THUMB, "");
      }
    }
  };

  if (img.complete) {
    applyIntrinsic();
  } else {
    img.addEventListener("load", applyIntrinsic, { once: true });
  }
}

function markReaderProfileThumbs(container: HTMLElement): void {
  const orderedFrames = [...container.querySelectorAll<HTMLElement>(`[${READER_IMG_FRAME}]`)];
  for (const frame of orderedFrames) {
    const img = frame.querySelector("img");
    if (!img) {
      continue;
    }
    tryMarkProfileThumb(frame, img, orderedFrames);
  }
}

/**
 * Handles the "orphaned bio image" pattern where publishers emit:
 *   <p><img /></p>
 *   <p><a>Author Name</a></p>
 *   <p>Author bio text...</p>
 *
 * These three sibling <p> elements share no common DOM wrapper, so the existing
 * `markReaderMediaAsideLayouts` (needs a single wrapper with 2 children) and the
 * `data-reader-profile-thumb` float (works only when image+text share a parent) both
 * miss this case. This pass synthesizes a `<div data-reader-media-aside>` wrapper
 * around the image + its 1–2 immediately-following text siblings, letting the existing
 * CSS flex-row layout take over.
 */
function wrapOrphanedProfileImageParagraphs(container: HTMLElement): void {
  // Collect all image frames that are direct children of the article body or a top-level
  // block, excluding ones already inside a media-aside or profile-thumb context.
  const frames = [...container.querySelectorAll<HTMLElement>(`[${READER_IMG_FRAME}]`)];

  for (const frame of frames) {
    // Skip if already handled by another layout pass.
    if (frame.closest(`[${READER_MEDIA_ASIDE}]`) || frame.hasAttribute(READER_PROFILE_THUMB)) {
      continue;
    }

    // The frame may be directly in a block element or still inside its <p> wrapper
    // (unwrapImageOnlyParagraph may not have fired yet, or the image may be inside <a><p>).
    // Find the effective "anchor" node that sits as a direct child of a block parent.
    let anchor: HTMLElement = frame;
    const frameParent = frame.parentElement;
    if (
      frameParent &&
      frameParent.tagName === "P" &&
      hasOnlyElementOrWhitespace(frameParent, frame)
    ) {
      anchor = frameParent;
    } else if (
      frameParent?.tagName === "A" &&
      frameParent.parentElement?.tagName === "P" &&
      hasOnlyElementOrWhitespace(frameParent, frame)
    ) {
      anchor = frameParent.parentElement;
    }

    const host = anchor.parentElement;
    if (!host) {
      continue;
    }

    // Gather immediately-following sibling <p> elements (up to 2) that look like
    // text-only bio paragraphs. Stop at the first non-<p> or content-heavy sibling.
    const textSiblings: HTMLElement[] = [];
    let cursor = anchor.nextElementSibling as HTMLElement | null;
    while (cursor && textSiblings.length < 2) {
      if (cursor.tagName !== "P") {
        break;
      }
      if (!isLikelyTextOrLinkParagraph(cursor)) {
        break;
      }
      textSiblings.push(cursor);
      cursor = cursor.nextElementSibling as HTMLElement | null;
    }

    if (textSiblings.length === 0) {
      continue;
    }

    // Only wrap as media-aside when there's a positive author/bio signal.
    // Without this gate, normal captions and body text after images would
    // get incorrectly forced into side-by-side layout.
    const img = frame.querySelector("img");
    const hasAuthorClassSignal =
      PROFILE_IMG_CLASS_RE.test(img?.className ?? "") || isLikelyAuthorBlockHost(frame);
    const hasAuthorTextSignal = textSiblings.some((sib) =>
      AUTHOR_TEXT_RE.test((sib.textContent ?? "").trim()),
    );

    if (!hasAuthorClassSignal && !hasAuthorTextSignal) {
      continue;
    }

    // Wrap anchor + text siblings in a synthesized media-aside div.
    const wrapper = document.createElement("div");
    wrapper.setAttribute(READER_MEDIA_ASIDE, "");
    host.insertBefore(wrapper, anchor);
    wrapper.appendChild(anchor);
    for (const sib of textSiblings) {
      wrapper.appendChild(sib);
    }

    // Constrain the image frame to thumbnail size inside the wrapper.
    frame.setAttribute(READER_PROFILE_THUMB, "");
  }
}

/** Returns true when a <p> contains only text nodes, links, or inline elements — i.e., it
 *  looks like a bio sentence rather than a paragraph full of nested blocks or images. */
function isLikelyTextOrLinkParagraph(p: HTMLElement): boolean {
  // Must not contain any block-level or media elements.
  if (p.querySelector("img, figure, table, pre, ul, ol, div, section, article")) {
    return false;
  }
  // Must have some non-whitespace text content.
  if (!(p.textContent ?? "").trim()) {
    return false;
  }
  return true;
}

function hasOnlyElementOrWhitespace(parent: Element, element: Element): boolean {
  for (const child of Array.from(parent.childNodes)) {
    if (child === element) {
      continue;
    }
    if (child.nodeType === Node.TEXT_NODE && !(child.textContent ?? "").trim()) {
      continue;
    }
    return false;
  }
  return true;
}

function unwrapImageOnlyParagraph(frame: HTMLElement): void {
  const parent = frame.parentElement;
  if (!parent) {
    return;
  }

  const paragraph = parent.tagName === "P" ? parent : parent.parentElement;
  if (!paragraph || paragraph.tagName !== "P") {
    return;
  }

  // Case 1: <p><span data-reader-img-frame /></p>
  if (parent === paragraph && hasOnlyElementOrWhitespace(paragraph, frame)) {
    const host = paragraph.parentNode;
    if (!host) {
      return;
    }
    host.insertBefore(frame, paragraph);
    paragraph.remove();
    return;
  }

  // Case 2: <p><a><span data-reader-img-frame /></a></p>
  if (parent.tagName === "A" && hasOnlyElementOrWhitespace(parent, frame)) {
    if (!hasOnlyElementOrWhitespace(paragraph, parent)) {
      return;
    }
    const host = paragraph.parentNode;
    if (!host) {
      return;
    }
    host.insertBefore(parent, paragraph);
    paragraph.remove();
  }
}

function enhanceArticleBodyImages(container: HTMLElement): void {
  for (const img of container.querySelectorAll<HTMLImageElement>("img")) {
    if (img.closest(`[${READER_IMG_FRAME}]`)) {
      continue;
    }

    const parent = img.parentNode;
    if (!parent) {
      continue;
    }

    const wrap = document.createElement("span");
    wrap.setAttribute(READER_IMG_FRAME, "");
    wrap.setAttribute("data-reader-img-loading", "true");
    wrap.className = "relative block w-full overflow-hidden rounded-md";

    const skeletonEl = document.createElement("div");
    skeletonEl.setAttribute("aria-hidden", "true");
    skeletonEl.className = cn(
      skeletonShimmerClassName,
      "pointer-events-none absolute inset-0 z-0 min-h-[4rem]",
    );

    parent.insertBefore(wrap, img);
    wrap.appendChild(skeletonEl);
    wrap.appendChild(img);
    unwrapImageOnlyParagraph(wrap);

    img.classList.add(
      "relative",
      "z-10",
      "h-auto",
      "min-h-0",
      "w-full",
      "opacity-0",
      "transition-opacity",
      "duration-200",
    );

    const reveal = (): void => {
      wrap.removeAttribute("data-reader-img-loading");
      skeletonEl.remove();
      img.classList.remove("opacity-0");
    };

    if (img.complete && img.naturalWidth > 0) {
      reveal();
    } else {
      img.addEventListener("load", reveal, { once: true });
      img.addEventListener("error", reveal, { once: true });
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * CLIENT-SIDE CAROUSEL STRIPPING (defense-in-depth for feeds bypassing API)
 * ────────────────────────────────────────────────────────────────────────────── */

const CLIENT_CAROUSEL_CLASS_RE =
  /carousel|slider|slick|swiper|glide|dots?|indicator|pagination|pager|nav-thumb|slideshow|owl/i;

function isClientDotOrBullet(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (
    /^[\u2022\u25CF\u25CB\u25E6\u25FC\u25FB\u25A0\u25A1\u25AA\u25AB\u2013\u2014\u00B7\u2023\u2B24]$/.test(
      t,
    )
  )
    return true;
  if (/^\d{1,3}$/.test(t)) return true;
  return false;
}

function stripClientCarouselArtifacts(container: HTMLElement): void {
  for (const list of [...container.querySelectorAll<HTMLElement>("ul, ol")]) {
    const items = list.querySelectorAll(":scope > li");
    if (items.length === 0) {
      list.remove();
      continue;
    }
    const hasCarouselClass = CLIENT_CAROUSEL_CLASS_RE.test(list.className ?? "");
    const allDots = Array.from(items).every((li) => isClientDotOrBullet(li.textContent ?? ""));
    // For <ol>, bare numbers ("1","2","3") are legitimate — only strip if class signals carousel
    if (list.tagName === "OL" && !hasCarouselClass) continue;
    if (hasCarouselClass || allDots) {
      list.remove();
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * SEMANTIC CLASSIFICATION OF IMAGE-ADJACENT TEXT
 * ────────────────────────────────────────────────────────────────────────────── */

/** Regex matching photo/image credit patterns. */
const CREDIT_RE =
  /^(?:(?:photo|image|illustration|picture|video|graphic|source)s?\s*(?:by|courtesy|credit|via|from|:|\/))|(?:(?:getty|ap|reuters|afp|shutterstock|unsplash|pexels|istock|alamy|\u00a9|copyright|\(c\)))/i;

/**
 * Classifies text blocks that immediately follow image frames as either
 * caption, credit, or leaves them as normal body text.
 *
 * Rules:
 * - Skip anything inside a `<figure>` (already has semantic `<figcaption>` styling)
 * - Skip anything already tagged with a reader data attribute
 * - A following `<p>` with ≤20 words that matches CREDIT_RE → `data-reader-figure-credit`
 * - A following `<p>` with ≤35 words and ≤1 sentence → `data-reader-figure-caption`
 * - Anything else → left as normal body paragraph
 *
 * This only processes the first 1–2 siblings after each image frame.
 */
function classifyImageAdjacentText(container: HTMLElement): void {
  const frames = [...container.querySelectorAll<HTMLElement>(`[${READER_IMG_FRAME}]`)];

  for (const frame of frames) {
    // Skip images inside figures (figcaption handles those)
    if (frame.closest("figure")) continue;
    // Skip images already in media-aside or profile-thumb contexts
    if (frame.closest(`[${READER_MEDIA_ASIDE}]`) || frame.hasAttribute(READER_PROFILE_THUMB))
      continue;

    // Find the effective block-level anchor for this frame
    let anchor: HTMLElement = frame;
    const parent = frame.parentElement;
    if (parent?.tagName === "A") anchor = parent;

    let cursor = anchor.nextElementSibling as HTMLElement | null;
    let classified = 0;

    while (cursor && classified < 2) {
      // Only classify <p> siblings, stop at other block elements
      if (cursor.tagName !== "P") break;
      // Skip if already classified
      if (
        cursor.hasAttribute(READER_FIGURE_CAPTION) ||
        cursor.hasAttribute(READER_FIGURE_CREDIT) ||
        cursor.hasAttribute(READER_MEDIA_ASIDE)
      )
        break;
      // Skip if it contains images (probably another image block)
      if (cursor.querySelector("img, figure")) break;

      const text = (cursor.textContent ?? "").trim();
      if (!text) {
        cursor = cursor.nextElementSibling as HTMLElement | null;
        continue;
      }

      const wordCount = text.split(/\s+/).filter(Boolean).length;

      // Credit detection (highest priority, very short)
      if (wordCount <= 20 && CREDIT_RE.test(text)) {
        cursor.setAttribute(READER_FIGURE_CREDIT, "");
        classified++;
        cursor = cursor.nextElementSibling as HTMLElement | null;
        continue;
      }

      // Caption detection: short, typically 1 sentence, immediately after image.
      // Very short (≤15 words) is a strong caption signal.
      // Medium length (16–30 words) must also be ≤1 sentence to qualify.
      // >30 words is too long — treat as body text.
      if (classified === 0 && wordCount <= 30) {
        const sentenceCount = (text.match(/[.!?](?=\s|$)/g) ?? []).length;
        const isStrongCaption = wordCount <= 15;
        const isWeakCaption = wordCount <= 30 && sentenceCount <= 1;
        if (isStrongCaption || isWeakCaption) {
          cursor.setAttribute(READER_FIGURE_CAPTION, "");
          classified++;
          cursor = cursor.nextElementSibling as HTMLElement | null;
          continue;
        }
      }

      // If we get here, it's normal body text — stop classification for this image
      break;
    }
  }
}

export function RenderHtml({ html, baseUrl }: { html: string; baseUrl?: string | null }) {
  const prepared = prepareArticleHtml(html, baseUrl);

  return (
    <div
      key={prepared}
      className="article-body"
      suppressHydrationWarning
      ref={(node) => {
        if (!node || typeof document === "undefined") {
          return;
        }
        const codeRoots = enhanceArticleCodeBlocks(node);
        queueMicrotask(() => {
          stripClientCarouselArtifacts(node);
          enhanceArticleBodyImages(node);
          wrapOrphanedProfileImageParagraphs(node);
          markReaderMediaAsideLayouts(node);
          markReaderProfileThumbs(node);
          classifyImageAdjacentText(node);
        });
        return () => {
          for (const root of codeRoots) {
            root.unmount();
          }
        };
      }}
      dangerouslySetInnerHTML={{ __html: prepared }}
    />
  );
}
