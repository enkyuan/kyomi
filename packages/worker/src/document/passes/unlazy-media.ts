import { parseSrcset } from "@kyomi/reader/sanitization";
import type { ArticlePass } from "../context";

/** Lazy-loading attributes publishers use instead of `src` / `srcset`, strongest first. */
const LAZY_SRC_ATTRS = ["data-src", "data-lazy-src", "data-original", "data-lazy"] as const;
const LAZY_SRCSET_ATTRS = ["data-srcset", "data-lazy-srcset"] as const;

/** `src` values that stand in for the real image until a script swaps them. */
const PLACEHOLDER_SRC =
  /^data:|(?:^|[/_.-])(?:placeholder|grey-placeholder|spacer|blank|transparent|pixel|lazy|1x1)(?:[/_.-]|$)/i;

function isPlaceholderSrc(src: string | null): boolean {
  return !src?.trim() || PLACEHOLDER_SRC.test(src.trim());
}

function firstAttribute(element: Element, names: readonly string[]): string | null {
  for (const name of names) {
    const value = element.getAttribute(name)?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

/** Largest width (or density) candidate, used when an image has no `src` at all. */
function largestCandidate(srcset: string): string | null {
  let best: { url: string; size: number } | null = null;
  for (const { url, descriptor } of parseSrcset(srcset)) {
    const size = Number.parseFloat(descriptor) || 1;
    if (!best || size > best.size) {
      best = { url, size };
    }
  }
  return best?.url ?? null;
}

function promoteLazyAttributes(image: Element): void {
  const lazySrcset = firstAttribute(image, LAZY_SRCSET_ATTRS);
  if (lazySrcset && !image.getAttribute("srcset")?.trim()) {
    image.setAttribute("srcset", lazySrcset);
  }

  const lazySrc = firstAttribute(image, LAZY_SRC_ATTRS);
  if (lazySrc && isPlaceholderSrc(image.getAttribute("src"))) {
    image.setAttribute("src", lazySrc);
  }

  if (!image.getAttribute("src")?.trim()) {
    const ownSrcset = image.getAttribute("srcset");
    const picture = image.parentElement?.tagName === "PICTURE" ? image.parentElement : null;
    // Prefer an untyped <source> (the publisher's fallback format) over webp/avif variants.
    const source =
      picture?.querySelector("source[srcset]:not([type])") ??
      picture?.querySelector("source[srcset]");
    const fallback =
      (ownSrcset && largestCandidate(ownSrcset)) ||
      (source && largestCandidate(source.getAttribute("srcset") ?? ""));
    if (fallback) {
      image.setAttribute("src", fallback);
    }
  }
}

/** Images inside `<noscript>` are the real ones; a placeholder `<img>` usually sits beside it. */
function promoteNoscriptImages(noscript: Element): void {
  const images = Array.from(noscript.querySelectorAll("img"));
  if (images.length === 0) {
    return;
  }

  const alt = images[0]?.getAttribute("alt")?.trim();
  for (const sibling of [noscript.previousElementSibling, noscript.nextElementSibling]) {
    const siblingAlt = sibling?.getAttribute("alt")?.trim();
    if (
      sibling?.tagName === "IMG" &&
      isPlaceholderSrc(sibling.getAttribute("src")) &&
      (!alt || !siblingAlt || alt === siblingAlt)
    ) {
      sibling.remove();
    }
  }
  noscript.replaceWith(...images);
}

/**
 * Pass 4. Turns lazy-loaded media into plain media so it survives sanitizing. Runs before
 * `resolve-urls` so promoted URLs are resolved like any other.
 */
export const unlazyMedia: ArticlePass = (root) => {
  // Lazy attributes first, so a lazy image next to an unrelated <noscript> is not mistaken for
  // that fallback's placeholder.
  for (const image of Array.from(root.querySelectorAll("img"))) {
    promoteLazyAttributes(image);
  }
  for (const noscript of Array.from(root.querySelectorAll("noscript"))) {
    promoteNoscriptImages(noscript);
  }
  for (const frame of Array.from(root.querySelectorAll("iframe"))) {
    const lazySrc = firstAttribute(frame, LAZY_SRC_ATTRS);
    if (lazySrc && !frame.getAttribute("src")?.trim()) {
      frame.setAttribute("src", lazySrc);
    }
  }
};
