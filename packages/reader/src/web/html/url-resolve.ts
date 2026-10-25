import { isArticleFragmentHref, parseSrcset, serializeSrcset } from "../../sanitization";
import { normalizeSafeHttpUrl } from "../../core/url";

/**
 * Maps an absolute image URL to the URL the client should request (for example an image proxy).
 * Returning `null` or `undefined` keeps the original URL; a result that is not http(s) drops it.
 */
export type ReaderImageUrlTransformer = (url: string) => string | null | undefined;

/** Resolves an image URL against the article and routes it through the image transformer. */
function resolveImageUrl(
  url: string,
  baseUrl: string | null,
  transformImageUrl?: ReaderImageUrlTransformer,
): string | null {
  const normalized = normalizeSafeHttpUrl(url, baseUrl);
  if (!normalized) {
    return null;
  }
  return normalizeSafeHttpUrl(transformImageUrl?.(normalized) ?? normalized);
}

function rewriteAttribute(
  element: Element,
  name: string,
  rewrite: (value: string) => string | null,
) {
  const value = element.getAttribute(name);
  if (value === null) {
    return;
  }
  const next = rewrite(value);
  if (next) {
    element.setAttribute(name, next);
  } else {
    element.removeAttribute(name);
  }
}

/**
 * Makes link and media URLs absolute against the article URL. Every image request (`src`,
 * `srcset` candidates, video `poster`) goes through `transformImageUrl`, so a proxying client
 * never lets a responsive candidate load directly from the publisher. Video and audio files are
 * resolved but not transformed: the image proxy serves images only.
 */
export function resolveRelativeAssetUrls(
  html: string,
  baseUrl?: string | null,
  transformImageUrl?: ReaderImageUrlTransformer,
): string {
  if ((!baseUrl && !transformImageUrl) || typeof document === "undefined") {
    return html;
  }
  const normalizedBase = baseUrl ? normalizeSafeHttpUrl(baseUrl) : null;
  if (baseUrl && !normalizedBase && !transformImageUrl) {
    return html;
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const image = (value: string) => resolveImageUrl(value, normalizedBase, transformImageUrl);

  for (const link of tpl.content.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (!href || isArticleFragmentHref(href)) {
      continue;
    }
    rewriteAttribute(link, "href", (value) => normalizeSafeHttpUrl(value, normalizedBase));
  }

  for (const element of tpl.content.querySelectorAll("img[src]")) {
    rewriteAttribute(element, "src", image);
  }
  for (const element of tpl.content.querySelectorAll("video[poster]")) {
    rewriteAttribute(element, "poster", image);
  }
  for (const element of tpl.content.querySelectorAll("img[srcset], picture > source[srcset]")) {
    rewriteAttribute(element, "srcset", (value) => {
      const candidates = parseSrcset(value).flatMap(({ url, descriptor }) => {
        const resolved = image(url);
        return resolved ? [{ url: resolved, descriptor }] : [];
      });
      return candidates.length > 0 ? serializeSrcset(candidates) : null;
    });
  }
  for (const element of tpl.content.querySelectorAll(
    "video[src], audio[src], :is(video, audio) > source[src]",
  )) {
    rewriteAttribute(element, "src", (value) => normalizeSafeHttpUrl(value, normalizedBase));
  }

  return tpl.innerHTML;
}
