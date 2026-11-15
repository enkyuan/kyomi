import type { ReaderEmbedProvider, ReaderImage, ReaderInline } from "../../core/document";
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

/** Plain text of inlines, for labels and failure descriptions. */
export function inlinesToText(nodes: readonly ReaderInline[] | undefined): string {
  if (!nodes) {
    return "";
  }
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code":
          return node.value;
        case "format":
        case "link":
        case "abbr":
          return inlinesToText(node.children);
        case "break":
          return " ";
        case "math":
          return node.tex ?? "";
        case "footnoteRef":
          return node.label;
        case "image":
          return node.image.alt;
        default:
          return "";
      }
    })
    .join("");
}

const FRAME_HOSTS: Partial<Record<ReaderEmbedProvider, readonly string[]>> = {
  youtube: ["www.youtube-nocookie.com", "youtube-nocookie.com"],
  vimeo: ["player.vimeo.com"],
  spotify: ["open.spotify.com"],
  soundcloud: ["w.soundcloud.com"],
  "apple-podcasts": ["embed.podcasts.apple.com"],
  codepen: ["codepen.io"],
  codesandbox: ["codesandbox.io"],
  loom: ["www.loom.com"],
  figma: ["www.figma.com", "embed.figma.com"],
};

export function allowedFrameUrl(
  provider: ReaderEmbedProvider,
  frameUrl: string | undefined,
): string | null {
  if (!frameUrl) {
    return null;
  }
  try {
    const url = new URL(frameUrl);
    return url.protocol === "https:" && FRAME_HOSTS[provider]?.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/**
 * `rendered` is KaTeX output the compiler produced with `trust: false`. It is injected as-is, so
 * anything that is not plain KaTeX markup (scripts, frames, event handlers) is refused and the
 * math falls back to its source instead.
 */
const UNSAFE_RENDERED_RE =
  /<\s*(?:script|iframe|object|embed|link|style|base|form)\b|\son[a-z]+\s*=|javascript:/i;

export function isTrustedKatexHtml(html: string): boolean {
  return !UNSAFE_RENDERED_RE.test(html);
}
