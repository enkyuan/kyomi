import { filterArticleClassAttr } from "./article-classes";
import { parseSrcset } from "./srcset";
import { ARTICLE_EMBED_PROVIDERS, ARTICLE_MATHML_TAGS } from "./article-policy";

/**
 * Value rules applied after neosanitize has filtered attribute names. neosanitize only blocks
 * script-capable URL schemes, so every URL here is narrowed to http(s), and every attribute a
 * renderer reads is checked against the shape it expects.
 */

/** Compiler-assigned anchor ids (`kyomi-` prefix keeps them clear of app ids and globals). */
const KYOMI_ANCHOR = /^kyomi-[a-z0-9][a-z0-9-]{0,63}$/;
const KYOMI_FRAGMENT = /^#kyomi-[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_SRCSET_CANDIDATES = 8;

const STYLE_ALLOWED_TAGS = new Set<string>(["span", ...ARTICLE_MATHML_TAGS]);
const MEDIA_TAGS = new Set(["video", "audio"]);
const EMBED_PROVIDERS = new Set<string>(ARTICLE_EMBED_PROVIDERS);

/** True for a compiler-made in-page link, which URL resolvers must leave relative. */
export function isArticleFragmentHref(value: string): boolean {
  return KYOMI_FRAGMENT.test(value.trim());
}

function isSafeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

const BOUNDED = (max: number) => (value: string) => value.length <= max;
const MATCHES = (pattern: RegExp) => (value: string) => pattern.test(value);
const BOOLEAN_ATTR = (value: string) => value === "" || value.toLowerCase() === "true";

/** Attribute value validators; an attribute whose value fails is removed. */
const VALUE_RULES: Record<string, (value: string) => boolean> = {
  href: (value) => isSafeHttpUrl(value) || isArticleFragmentHref(value),
  src: isSafeHttpUrl,
  poster: isSafeHttpUrl,
  "data-kyomi-url": isSafeHttpUrl,
  id: MATCHES(KYOMI_ANCHOR),
  lang: MATCHES(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,4}$/),
  dir: MATCHES(/^(?:ltr|rtl|auto)$/i),
  align: MATCHES(/^(?:left|center|right)$/i),
  width: MATCHES(/^\d{1,5}$/),
  height: MATCHES(/^\d{1,5}$/),
  start: MATCHES(/^-?\d{1,6}$/),
  value: MATCHES(/^-?\d{1,6}$/),
  colspan: MATCHES(/^\d{1,3}$/),
  rowspan: MATCHES(/^\d{1,3}$/),
  scope: MATCHES(/^(?:row|col|rowgroup|colgroup)$/i),
  display: MATCHES(/^(?:block|inline)$/i),
  reversed: BOOLEAN_ATTR,
  open: BOOLEAN_ATTR,
  datetime: BOUNDED(64),
  sizes: BOUNDED(256),
  media: BOUNDED(256),
  type: MATCHES(/^[a-z0-9.+-]+\/[a-z0-9.+-]+(?:;[^<>"]{0,96})?$/i),
  "data-kyomi-embed": (value) => EMBED_PROVIDERS.has(value),
  "data-kyomi-lang": MATCHES(/^[A-Za-z0-9+#._-]{1,64}$/),
  // oxlint-disable-next-line no-control-regex -- rejecting control characters is the point
  "data-kyomi-filename": MATCHES(/^[^\u0000-\u001f<>"]{1,256}$/),
  "data-kyomi-lines": MATCHES(/^\d[\d,\s-]{0,63}$/),
  "data-kyomi-checked": MATCHES(/^(?:true|false)$/),
};

/** Keeps http(s) candidates of a `srcset` with at most one width or density descriptor. */
export function sanitizeSrcset(value: string): string | null {
  const kept: string[] = [];
  for (const { url, descriptor } of parseSrcset(value)) {
    if (!isSafeHttpUrl(url) || (descriptor && !/^\d+(?:\.\d+)?[wx]$/.test(descriptor))) {
      continue;
    }
    kept.push(descriptor ? `${url} ${descriptor}` : url);
    if (kept.length === MAX_SRCSET_CANDIDATES) {
      break;
    }
  }
  return kept.length > 0 ? kept.join(", ") : null;
}

export function normalizeElementAttributes(element: Element): void {
  const tag = element.tagName.toLowerCase();

  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    /* TypeDoc / documentation builds emit data-tsd-* (e.g. source paths); never keep in reader HTML. */
    if (name.startsWith("data-tsd-")) {
      element.removeAttribute(attr.name);
      continue;
    }
    const rule = VALUE_RULES[name];
    if (rule && !rule(attr.value.trim())) {
      element.removeAttribute(attr.name);
    }
  }

  const srcset = element.getAttribute("srcset");
  if (srcset !== null) {
    const next = sanitizeSrcset(srcset);
    if (next === null) {
      element.removeAttribute("srcset");
    } else {
      element.setAttribute("srcset", next);
    }
  }

  const classValue = element.getAttribute("class");
  if (classValue !== null) {
    const next = filterArticleClassAttr(tag, classValue);
    if (next === null) {
      element.removeAttribute("class");
    } else {
      element.setAttribute("class", next);
    }
  }

  const styleValue = element.getAttribute("style");
  if (styleValue !== null) {
    if (!STYLE_ALLOWED_TAGS.has(tag) || !styleValue.trim()) {
      element.removeAttribute("style");
    }
  }

  if (tag === "img") {
    if (!element.hasAttribute("loading")) {
      element.setAttribute("loading", "lazy");
    }
    if (!element.hasAttribute("decoding")) {
      element.setAttribute("decoding", "async");
    }
  }

  if (MEDIA_TAGS.has(tag)) {
    // Media files are not proxied, so nothing is fetched until the reader presses play.
    element.setAttribute("controls", "");
    element.setAttribute("preload", "none");
  }
}
