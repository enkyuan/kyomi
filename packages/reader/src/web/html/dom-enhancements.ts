import type { ReaderLayoutMode } from "../../core";
import { normalizeCaptionText } from "./string-prep";
import {
  READER_FIGURE_CAPTION,
  READER_FIGURE_CREDIT,
  READER_FIGURE_HAS_CAPTION,
  READER_IMG_FRAME,
  READER_INLINE_IMG,
  READER_MEDIA_ASIDE,
  READER_PROFILE_THUMB,
} from "./constants";

const skeletonShimmerClassName =
  "animate-skeleton rounded-sm [--skeleton-highlight:--alpha(var(--color-white)/64%)] [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--color-muted)_0_0/200%_100%_fixed] dark:[--skeleton-highlight:--alpha(var(--color-white)/4%)]";

function cn(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

/** Avoid treating a whole article wrapper (hero image + many blocks) as a single media row. */
const MEDIA_ASIDE_MAX_DIRECT_CHILDREN = 8;

const INLINE_CONTEXT_TAGS = new Set([
  "A",
  "EM",
  "STRONG",
  "SPAN",
  "SMALL",
  "P",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
]);

const BADGE_OR_ICON_RE = /badge|icon|emoji|logo|shield|status|avatar/i;
const PLACEHOLDER_IMG_RE =
  /placeholder|grey-placeholder|spacer|blank|pixel|transparent(?:\.gif|\.png)?/i;
const PLACEHOLDER_CLASS_RE = /placeholder|unavailable|skeleton|lazy(?:load|loading)?|loading/i;
const SOCIAL_LINK_RE =
  /(?:^|\.)x\.com$|twitter\.com$|linkedin\.com$|facebook\.com$|instagram\.com$/i;

function parsePositiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function countMeaningfulNonImageText(parent: HTMLElement, target: HTMLImageElement): number {
  let chars = 0;
  for (const node of Array.from(parent.childNodes)) {
    if (node === target) {
      continue;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      chars += (node.textContent ?? "").trim().length;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }
    const el = node as HTMLElement;
    if (el.tagName === "IMG" || el.querySelector("img")) {
      continue;
    }
    chars += (el.textContent ?? "").trim().length;
  }
  return chars;
}

function isLikelyInlineImage(img: HTMLImageElement): boolean {
  if (img.closest("pre, code, table, figure")) {
    return false;
  }
  const cls = `${img.className ?? ""} ${img.getAttribute("alt") ?? ""}`;
  const src = img.getAttribute("src") ?? "";
  const width = parsePositiveInt(img.getAttribute("width"));
  const height = parsePositiveInt(img.getAttribute("height"));

  if (BADGE_OR_ICON_RE.test(cls) || BADGE_OR_ICON_RE.test(src)) {
    return true;
  }
  if ((width && width <= 64) || (height && height <= 64)) {
    return true;
  }

  const parent = img.parentElement;
  if (!parent) {
    return false;
  }
  if (!INLINE_CONTEXT_TAGS.has(parent.tagName)) {
    return false;
  }
  const siblingImages = parent.querySelectorAll(":scope > img").length;
  const nonImageTextChars = countMeaningfulNonImageText(parent, img);
  return siblingImages >= 2 || nonImageTextChars > 0;
}

function isLikelyPlaceholderImage(img: HTMLImageElement): boolean {
  const src = img.getAttribute("src") ?? "";
  const cls = img.className ?? "";
  if (PLACEHOLDER_IMG_RE.test(src) || PLACEHOLDER_CLASS_RE.test(cls)) {
    return true;
  }
  const width = parsePositiveInt(img.getAttribute("width"));
  const height = parsePositiveInt(img.getAttribute("height"));
  return Boolean((width && width <= 16) || (height && height <= 16));
}

function pruneRedundantLazyImages(container: HTMLElement): void {
  const hosts = container.querySelectorAll<HTMLElement>("p, div, figure, a");
  for (const host of hosts) {
    const imgs = Array.from(host.querySelectorAll<HTMLImageElement>(":scope > img"));
    if (imgs.length < 2) {
      continue;
    }
    const realImages = imgs.filter((img) => !isLikelyPlaceholderImage(img));
    if (realImages.length === 0) {
      continue;
    }
    for (const img of imgs) {
      if (realImages.includes(img)) {
        continue;
      }
      img.remove();
    }
  }
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
  if (!words.every((w) => /^[A-Z][a-zA-Z.'-]+$/.test(w))) {
    return false;
  }
  return true;
}

function removeLikelyAuthorCards(container: HTMLElement): void {
  const blocks = container.querySelectorAll<HTMLElement>("div, section, article, figure");
  for (const block of blocks) {
    if (block.querySelectorAll("img").length === 0) {
      continue;
    }
    const links = Array.from(block.querySelectorAll("a[href]"));
    if (links.length === 0) {
      continue;
    }
    const socialLinks = links.filter((a) => {
      try {
        const href = a.getAttribute("href");
        if (!href) {
          return false;
        }
        return SOCIAL_LINK_RE.test(new URL(href).hostname);
      } catch {
        return false;
      }
    });
    if (socialLinks.length < 2) {
      continue;
    }
    const text = (block.textContent ?? "").replace(/\s+/g, " ").trim();
    const wordCount = text ? text.split(" ").length : 0;
    const looksAuthor =
      /\b(author|editor|writer|journalist|columnist|contributor|lives in|follow)\b/i.test(text) ||
      looksLikePersonName(text);
    if (looksAuthor && wordCount > 0 && wordCount <= 120) {
      block.remove();
    }
  }
}

function dedupeFigureInlineCaptionNoise(container: HTMLElement): void {
  for (const figure of container.querySelectorAll("figure")) {
    const figcaption = figure.querySelector("figcaption");
    if (!figcaption) {
      continue;
    }
    const cap = normalizeCaptionText(figcaption.textContent ?? "");
    if (!cap) {
      continue;
    }
    for (const p of figure.querySelectorAll("p")) {
      if (!p.querySelector("img")) {
        continue;
      }
      for (const child of Array.from(p.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const value = normalizeCaptionText(child.textContent ?? "");
          if (value && (cap.includes(value) || value.includes(cap))) {
            child.remove();
          }
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }
        const el = child as HTMLElement;
        if (el.tagName === "IMG" || el.querySelector("img")) {
          continue;
        }
        const value = normalizeCaptionText(el.textContent ?? "");
        if (value && (cap.includes(value) || value.includes(cap))) {
          el.remove();
        }
      }
    }
  }
}

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
    if (secondTag !== "DIV" && secondTag !== "SECTION" && secondTag !== "ARTICLE") {
      continue;
    }
    markReaderMediaAsideElement(el);
  }
}

const PROFILE_IMG_CLASS_RE =
  /avatar|headshot|profile|photo|gravatar|author-img|authorimage|contributor|columnist/i;

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

  const viaAdjacentText = (() => {
    const parent = frame.parentElement;
    if (!parent) return false;
    let cursor = frame.nextElementSibling ?? parent.nextElementSibling;
    for (let i = 0; i < 3 && cursor; i++) {
      const text = (cursor.textContent ?? "").trim();
      if (text && (AUTHOR_TEXT_RE.test(text) || looksLikePersonName(text))) return true;
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

function wrapOrphanedProfileImageParagraphs(container: HTMLElement): void {
  const frames = [...container.querySelectorAll<HTMLElement>(`[${READER_IMG_FRAME}]`)];

  for (const frame of frames) {
    if (frame.closest(`[${READER_MEDIA_ASIDE}]`) || frame.hasAttribute(READER_PROFILE_THUMB)) {
      continue;
    }

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
      anchor = frameParent.parentElement!;
    }

    const host = anchor.parentElement;
    if (!host) {
      continue;
    }

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

    const img = frame.querySelector("img");
    const hasAuthorClassSignal =
      PROFILE_IMG_CLASS_RE.test(img?.className ?? "") || isLikelyAuthorBlockHost(frame);
    const hasAuthorTextSignal = textSiblings.some((sib) =>
      AUTHOR_TEXT_RE.test((sib.textContent ?? "").trim()),
    );

    if (!hasAuthorClassSignal && !hasAuthorTextSignal) {
      continue;
    }

    const wrapper = document.createElement("div");
    wrapper.setAttribute(READER_MEDIA_ASIDE, "");
    host.insertBefore(wrapper, anchor);
    wrapper.appendChild(anchor);
    for (const sib of textSiblings) {
      wrapper.appendChild(sib);
    }

    frame.setAttribute(READER_PROFILE_THUMB, "");
  }
}

function isLikelyTextOrLinkParagraph(p: HTMLElement): boolean {
  if (p.querySelector("img, figure, table, pre, ul, ol, div, section, article")) {
    return false;
  }
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

  if (parent === paragraph && hasOnlyElementOrWhitespace(paragraph, frame)) {
    const host = paragraph.parentNode;
    if (!host) {
      return;
    }
    host.insertBefore(frame, paragraph);
    paragraph.remove();
    return;
  }

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

/** Remove loading skeleton once the image has dimensions (load, error, or decode). */
function bindReaderImageReveal(
  wrap: HTMLElement,
  skeletonEl: HTMLElement,
  img: HTMLImageElement,
): void {
  let revealed = false;
  const reveal = (): void => {
    if (revealed) {
      return;
    }
    revealed = true;
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

  requestAnimationFrame(() => {
    if (img.naturalWidth > 0 || img.naturalHeight > 0) {
      reveal();
    }
  });
}

function enhanceArticleBodyImages(container: HTMLElement): void {
  pruneRedundantLazyImages(container);
  dedupeFigureInlineCaptionNoise(container);

  for (const img of container.querySelectorAll<HTMLImageElement>("img")) {
    if (img.closest(`[${READER_IMG_FRAME}]`)) {
      continue;
    }
    if (isLikelyInlineImage(img)) {
      img.setAttribute(READER_INLINE_IMG, "");
      continue;
    }

    const parent = img.parentNode;
    if (!parent) {
      continue;
    }

    const wrap = document.createElement("span");
    wrap.setAttribute(READER_IMG_FRAME, "");
    wrap.setAttribute("data-reader-img-loading", "true");
    wrap.className = "relative block overflow-hidden rounded-md";

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
      "max-w-full",
      "opacity-0",
      "transition-opacity",
      "duration-200",
    );

    bindReaderImageReveal(wrap, skeletonEl, img);
  }
}

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
    if (list.tagName === "OL" && !hasCarouselClass) continue;
    if (hasCarouselClass || allDots) {
      list.remove();
    }
  }
}

const CREDIT_RE =
  /^(?:(?:photo|image|illustration|picture|video|graphic|source)s?\s*(?:by|courtesy|credit|via|from|:|\/))|(?:(?:getty|ap|reuters|afp|shutterstock|unsplash|pexels|istock|alamy|\u00a9|copyright|\(c\)))/i;

function looksLikeBareCreditLabel(text: string): boolean {
  const compact = text.trim().replace(/\s+/g, " ");
  if (!compact) {
    return false;
  }
  const words = compact.split(" ");
  if (words.length < 2 || words.length > 5) {
    return false;
  }
  if (!words.every((word) => /^[A-Z][a-zA-Z.'-]*$/.test(word))) {
    return false;
  }
  return true;
}

function classifyImageAdjacentText(container: HTMLElement): void {
  const frames = [...container.querySelectorAll<HTMLElement>(`[${READER_IMG_FRAME}]`)];

  for (const frame of frames) {
    if (frame.closest("figure")) continue;
    if (frame.closest(`[${READER_MEDIA_ASIDE}]`) || frame.hasAttribute(READER_PROFILE_THUMB))
      continue;

    let anchor: HTMLElement = frame;
    const parent = frame.parentElement;
    if (parent?.tagName === "A") anchor = parent;

    let cursor = anchor.nextElementSibling as HTMLElement | null;
    let classified = 0;
    let hasCaption = false;

    while (cursor && classified < 2) {
      if (cursor.tagName !== "P") break;
      if (
        cursor.hasAttribute(READER_FIGURE_CAPTION) ||
        cursor.hasAttribute(READER_FIGURE_CREDIT) ||
        cursor.hasAttribute(READER_MEDIA_ASIDE)
      )
        break;
      if (cursor.querySelector("img, figure")) break;

      const text = (cursor.textContent ?? "").trim();
      if (!text) {
        cursor = cursor.nextElementSibling as HTMLElement | null;
        continue;
      }

      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const nextText =
        cursor.nextElementSibling?.tagName === "P"
          ? (cursor.nextElementSibling.textContent ?? "").trim()
          : "";
      const nextWordCount = nextText ? nextText.split(/\s+/).filter(Boolean).length : 0;

      if (
        (wordCount <= 20 && CREDIT_RE.test(text)) ||
        (classified === 0 &&
          wordCount <= 5 &&
          looksLikeBareCreditLabel(text) &&
          nextWordCount > 0 &&
          nextWordCount <= 30)
      ) {
        cursor.setAttribute(READER_FIGURE_CREDIT, "");
        classified++;
        cursor = cursor.nextElementSibling as HTMLElement | null;
        continue;
      }

      if (!hasCaption && wordCount <= 30) {
        const sentenceCount = (text.match(/[.!?](?=\s|$)/g) ?? []).length;
        const isStrongCaption = wordCount <= 15;
        const isWeakCaption = wordCount <= 30 && sentenceCount <= 1;
        if (isStrongCaption || isWeakCaption) {
          cursor.setAttribute(READER_FIGURE_CAPTION, "");
          classified++;
          hasCaption = true;
          cursor = cursor.nextElementSibling as HTMLElement | null;
          continue;
        }
      }

      break;
    }
  }
}

function markCaptionedFigures(container: HTMLElement): void {
  for (const figure of container.querySelectorAll<HTMLElement>("figure")) {
    const caption = figure.querySelector<HTMLElement>(":scope > figcaption");
    if (!caption) {
      figure.removeAttribute(READER_FIGURE_HAS_CAPTION);
      continue;
    }

    const captionText = normalizeCaptionText(caption.textContent ?? "");
    if (!captionText) {
      figure.removeAttribute(READER_FIGURE_HAS_CAPTION);
      continue;
    }

    const hasMedia = Boolean(
      figure.querySelector(
        `:scope > [${READER_IMG_FRAME}], :scope > img, :scope > picture, :scope > video, :scope > iframe, :scope > p > [${READER_IMG_FRAME}], :scope > p > img`,
      ),
    );

    if (hasMedia) {
      figure.setAttribute(READER_FIGURE_HAS_CAPTION, "");
    } else {
      figure.removeAttribute(READER_FIGURE_HAS_CAPTION);
    }
  }
}

/** Runs client-side reader DOM passes after sanitized HTML is injected. Order matters. */
export function runReaderDomEnhancements(
  container: HTMLElement,
  options?: { layoutMode?: ReaderLayoutMode },
): void {
  const layoutMode = options?.layoutMode ?? "normalized";
  if (layoutMode === "fidelity") {
    enhanceArticleBodyImages(container);
    markCaptionedFigures(container);
    classifyImageAdjacentText(container);
    return;
  }

  stripClientCarouselArtifacts(container);
  removeLikelyAuthorCards(container);
  enhanceArticleBodyImages(container);
  markCaptionedFigures(container);
  wrapOrphanedProfileImageParagraphs(container);
  markReaderMediaAsideLayouts(container);
  markReaderProfileThumbs(container);
  classifyImageAdjacentText(container);
}
