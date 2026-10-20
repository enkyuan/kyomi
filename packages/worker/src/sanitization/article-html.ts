import { Sanitizer, type PolicyInput } from "neosanitize";
import { normalizeElementAttributes } from "./article-attributes";
import {
  ARTICLE_HTML_ALLOWED_ATTR,
  ARTICLE_HTML_ALLOWED_TAGS,
  ARTICLE_HTML_TAG_ATTRS,
} from "./article-policy";

/**
 * Shared article HTML policy for server + browser reader sanitization.
 *
 * Goals:
 * - Preserve structural wrappers (e.g. div-based author cards, figures, callouts)
 * - Keep publisher semantics: emphasis, edits, definition lists, table captions, responsive
 *   images, direct media, and MathML layout
 * - Allow conservative `class` tokens for layout/semantics; keep code `language-*`
 * - Strip interactive/page chrome, scripts, and dangerous URLs
 * - Restrict inline `style` to MathML + spans (KaTeX); rely on tags/classes elsewhere
 * - Accept only compiler-shaped `kyomi-` ids and `data-kyomi-*` hints
 */

export {
  ARTICLE_EMBED_PROVIDERS,
  ARTICLE_HTML_ALLOWED_ATTR,
  ARTICLE_HTML_ALLOWED_TAGS,
  ARTICLE_HTML_DROP_CONTENT_TAGS,
  ARTICLE_HTML_FORBID_TAGS,
  ARTICLE_HTML_SANITIZER_VERSION,
  ARTICLE_HTML_TAG_ATTRS,
} from "./article-policy";
export { isArticleFragmentHref, sanitizeSrcset } from "./article-attributes";
export { filterArticleClassAttr, isAllowedArticleClassToken } from "./article-classes";

/** Elements that are meaningful without children, so empty-element cleanup keeps them. */
const KEEP_WHEN_EMPTY = new Set([
  "br",
  "hr",
  "img",
  "source",
  "wbr",
  "video",
  "audio",
  "td",
  "th",
  "mspace",
]);

const ARTICLE_HTML_POLICY = {
  tags: ARTICLE_HTML_ALLOWED_TAGS,
  attrs: {
    "*": ARTICLE_HTML_ALLOWED_ATTR,
    ...ARTICLE_HTML_TAG_ATTRS,
  },
} satisfies PolicyInput;

const articleHtmlSanitizer = Sanitizer.builder(ARTICLE_HTML_POLICY).build();

/** A player whose only URL failed validation would render as a dead control. */
function hasPlayableSource(media: Element): boolean {
  return media.hasAttribute("src") || media.querySelector("source[src]") !== null;
}

function removeEmptyElements(root: ParentNode): void {
  const elements = Array.from(root.querySelectorAll("*")).reverse();
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    if ((tag === "video" || tag === "audio") && !hasPlayableSource(element)) {
      element.parentNode?.removeChild(element);
      continue;
    }
    if (KEEP_WHEN_EMPTY.has(tag) || element.hasAttribute("id")) {
      continue;
    }
    if (!element.hasChildNodes() && !element.textContent?.trim()) {
      element.parentNode?.removeChild(element);
    }
  }
}

export function sanitizeArticleHtmlFragment(html: string): string {
  return articleHtmlSanitizer.sanitize(html);
}

export function normalizeSanitizedArticleRoot(root: ParentNode): void {
  for (const element of Array.from(root.querySelectorAll("*"))) {
    normalizeElementAttributes(element);
  }
  removeEmptyElements(root);
}
