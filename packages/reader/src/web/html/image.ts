import { READER_IMG_FRAME, READER_INLINE_IMG } from "./constants";
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
    );

    bindReaderImageReveal(wrap, skeletonEl, img);
  }
}
