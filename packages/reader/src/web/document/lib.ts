import type { ReaderImage } from "../../core/document";
import { normalizeSafeHttpUrl } from "../../core/url";
import type { ReaderImageUrlTransformer } from "../html/url-resolve";

/** Compiler anchors are bare slugs; the DOM id gets the same `kyomi-` prefix the HTML path uses. */
export function anchorId(anchor: string): string {
  return `kyomi-${anchor}`;
}

/** Underscore is not a valid anchor character, so this id can never collide with a block anchor. */
export function footnoteRefId(id: string): string {
  return `kyomi-fnref_${id}`;
}

export function resolveImageUrl(
  url: string,
  transformImageUrl: ReaderImageUrlTransformer | undefined,
): string | null {
  const normalized = normalizeSafeHttpUrl(url);
  if (!normalized) {
    return null;
  }
  return normalizeSafeHttpUrl(transformImageUrl?.(normalized) ?? normalized);
}

export type ResolvedImage = { src: string; srcSet: string | undefined };

/** Routes the image and every srcset candidate through the transport; drops non-http results. */
export function resolveImage(
  image: ReaderImage,
  transformImageUrl: ReaderImageUrlTransformer | undefined,
): ResolvedImage | null {
  const src = resolveImageUrl(image.src, transformImageUrl);
  if (!src) {
    return null;
  }
  const candidates: string[] = [];
  for (const candidate of image.srcset ?? []) {
    const url = resolveImageUrl(candidate.url, transformImageUrl);
    if (!url) {
      continue;
    }
    const descriptor = candidate.width
      ? `${candidate.width}w`
      : candidate.density
        ? `${candidate.density}x`
        : "";
    candidates.push(descriptor ? `${url} ${descriptor}` : url);
  }
  return { src, srcSet: candidates.length > 0 ? candidates.join(", ") : undefined };
}

/** Same-document links scroll instead of navigating, so the router never sees a hash change. */
export function scrollToAnchor(event: { preventDefault(): void }, id: string): void {
  const target = document.getElementById(id);
  if (!target) {
    return;
  }
  event.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
}

export function isPlainLeftClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return !(event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
