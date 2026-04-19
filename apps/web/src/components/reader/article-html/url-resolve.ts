import { normalizeSafeHttpUrl } from "@lib/safe-http-url";

export function resolveRelativeAssetUrls(html: string, baseUrl?: string | null): string {
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
