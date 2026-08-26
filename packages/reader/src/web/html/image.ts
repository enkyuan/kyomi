import {
  READER_FIGURE_CAPTION,
  READER_IMG_FRAME,
  READER_IMG_UNAVAILABLE,
  READER_INLINE_IMG,
} from "./constants";
import { dedupeFigureInlineCaptionNoise } from "./caption";
import { cn, hasOnlyElementOrWhitespace, parsePositiveInt } from "./utils";

const skeletonShimmerClassName =
  "animate-skeleton rounded-sm [--skeleton-highlight:--alpha(var(--color-white)/64%)] [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--color-muted)_0_0/200%_100%_fixed] dark:[--skeleton-highlight:--alpha(var(--color-white)/4%)]";

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
const GENERIC_ALT_RE = /^(?:image|photo|picture|illustration|thumbnail)$/i;

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
    const realImageSet = new Set(realImages);
    for (const img of imgs) {
      if (realImageSet.has(img)) {
        continue;
      }
      img.remove();
    }
  }
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

function getMeaningfulText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text && !GENERIC_ALT_RE.test(text) ? text : null;
}

function getFigureCaption(wrap: HTMLElement): string | null {
  return getMeaningfulText(
    wrap.closest("figure")?.querySelector(":scope > figcaption")?.textContent,
  );
}

function getAdjacentCaption(wrap: HTMLElement): string | null {
  const anchor = wrap.parentElement?.tagName === "A" ? wrap.parentElement : wrap;
  const sibling = anchor.nextElementSibling as HTMLElement | null;
  if (!sibling?.hasAttribute(READER_FIGURE_CAPTION)) {
    return null;
  }
  return getMeaningfulText(sibling.textContent);
}

function createImageUnavailableIcon(): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(namespace, "svg");
  icon.classList.add("reader-image-unavailable-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("fill", "none");
  icon.setAttribute("viewBox", "0 0 16 16");

  const frame = document.createElementNS(namespace, "rect");
  frame.setAttribute("height", "11");
  frame.setAttribute("rx", "1.5");
  frame.setAttribute("width", "13");
  frame.setAttribute("x", "1.5");
  frame.setAttribute("y", "2.5");

  const landscape = document.createElementNS(namespace, "path");
  landscape.setAttribute("d", "m3.5 11 2.4-2.4 1.8 1.8 1.3-1.3 2.5 2.5");

  const sun = document.createElementNS(namespace, "circle");
  sun.setAttribute("cx", "5.25");
  sun.setAttribute("cy", "6.25");
  sun.setAttribute("r", "0.75");

  const slash = document.createElementNS(namespace, "path");
  slash.setAttribute("d", "M2 2 14 14");

  icon.append(frame, landscape, sun, slash);
  return icon;
}

function removeDecorativeImageFallback(wrap: HTMLElement): void {
  const parent = wrap.parentElement;
  wrap.remove();

  if (!parent || parent.textContent?.trim() || parent.childElementCount > 0) {
    return;
  }

  if (parent.tagName === "P" || parent.tagName === "A" || parent.tagName === "FIGURE") {
    parent.remove();
  }
}

function replaceWithImageUnavailable(
  wrap: HTMLElement,
  skeletonEl: HTMLElement,
  img: HTMLImageElement,
): void {
  const figureCaption = getFigureCaption(wrap);
  const adjacentCaption = getAdjacentCaption(wrap);
  const alt = getMeaningfulText(img.getAttribute("alt"));
  const externalDescription = figureCaption ?? adjacentCaption;

  wrap.removeAttribute("data-reader-img-loading");
  wrap.removeAttribute("data-reader-photo-view");
  skeletonEl.remove();
  img.remove();

  if (!externalDescription && !alt) {
    removeDecorativeImageFallback(wrap);
    return;
  }

  wrap.setAttribute(READER_IMG_UNAVAILABLE, "");

  const notice = document.createElement("span");
  notice.className = "reader-image-unavailable";
  notice.setAttribute("role", "note");
  notice.setAttribute(
    "aria-label",
    `Image unavailable: ${externalDescription ?? alt ?? "Image unavailable"}`,
  );

  const label = document.createElement("span");
  label.className = "reader-image-unavailable-label";
  label.append(createImageUnavailableIcon(), document.createTextNode("Image unavailable"));
  notice.append(label);

  if (!externalDescription && alt) {
    const description = document.createElement("span");
    description.className = "reader-image-unavailable-description";
    description.textContent = alt;
    notice.append(description);
  }

  wrap.appendChild(notice);
}

/** Reveal loaded images and replace failed media with a compact semantic fallback. */
function bindReaderImageReveal(
  wrap: HTMLElement,
  skeletonEl: HTMLElement,
  img: HTMLImageElement,
): void {
  let revealed = false;
  let settling = false;
  const reveal = (): void => {
    if (revealed) {
      return;
    }
    revealed = true;
    wrap.removeAttribute("data-reader-img-loading");
    skeletonEl.remove();
    img.classList.remove("opacity-0");
  };

  const markUnavailable = (): void => {
    if (revealed) {
      return;
    }
    revealed = true;
    replaceWithImageUnavailable(wrap, skeletonEl, img);
  };

  const hasDecodedDimensions = (): boolean => img.naturalWidth > 0 || img.naturalHeight > 0;

  const decodeThenSettle = (loadConfirmed = false): void => {
    if (revealed || settling) {
      return;
    }
    if (typeof img.decode !== "function") {
      if (loadConfirmed || hasDecodedDimensions()) {
        reveal();
      }
      return;
    }
    settling = true;
    void img.decode().then(reveal, () => {
      settling = false;
      // Expo DOM/WebKit may reject decode while an eager image is still settling.
      // A successful load event or populated dimensions is the authoritative success signal;
      // only the image error event below can turn the image into an unavailable fallback.
      if (loadConfirmed || hasDecodedDimensions()) {
        reveal();
      }
    });
  };

  img.addEventListener("load", () => decodeThenSettle(true), { once: true });
  img.addEventListener("error", markUnavailable, { once: true });

  if (img.complete && hasDecodedDimensions()) {
    decodeThenSettle();
  }

  requestAnimationFrame(() => {
    if (hasDecodedDimensions()) {
      reveal();
    }
  });
}

export function enhanceArticleBodyImages(container: HTMLElement): void {
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
      "ease-out",
    );

    bindReaderImageReveal(wrap, skeletonEl, img);
  }
}
