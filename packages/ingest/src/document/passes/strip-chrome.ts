import { ARTICLE_HTML_DROP_CONTENT_TAGS } from "@kyomi/reader/sanitization";
import { countDropped, unwrapElement, type ArticlePass } from "../context";

/** Calls to action and share bars, matched as whole class tokens or token prefixes. */
const CHROME_CLASS =
  /(?:^|[\s_-])(?:newsletter|subscribe|subscription|signup|sign-up|cta|share-buttons|sharedaddy|social-share|sharebar)(?:$|[\s_-])/i;
/** Short enough to be a widget, never a whole-article wrapper. */
const MAX_CHROME_TEXT = 400;

/** Image-viewer prompts some platforms inject as text (Medium). */
const VIEWER_PROMPTS = new Set(["press enter or click to view image in full size"]);

/** Heading permalink glyphs (`#`, `¶`, `§`, link emoji, zero-width space). */
const PERMALINK_TEXT = /^[\s#¶§🔗\u200b]*$/u;

function isAttributionFooter(footer: Element): boolean {
  return footer.parentElement?.closest("blockquote, figure") !== null;
}

function dropContentTags(root: HTMLElement, context: Parameters<ArticlePass>[1]): void {
  // Document order visits an outer element before its descendants, which are then disconnected,
  // so each removed subtree is counted once, by its outermost tag.
  for (const element of Array.from(
    root.querySelectorAll(ARTICLE_HTML_DROP_CONTENT_TAGS.join(",")),
  )) {
    if (!element.isConnected || (element.tagName === "FOOTER" && isAttributionFooter(element))) {
      continue;
    }
    countDropped(context, element);
    element.remove();
  }
}

function dropCallsToAction(root: HTMLElement, context: Parameters<ArticlePass>[1]): void {
  for (const element of Array.from(root.querySelectorAll("[class]"))) {
    if (!element.isConnected || !CHROME_CLASS.test(element.getAttribute("class") ?? "")) {
      continue;
    }
    const text = element.textContent?.trim() ?? "";
    if (text.length <= MAX_CHROME_TEXT && !element.querySelector("h1, h2, h3, img, pre, table")) {
      countDropped(context, element);
      element.remove();
    }
  }
}

function dropViewerPrompts(root: HTMLElement): void {
  for (const element of Array.from(root.querySelectorAll("span, p, div, figcaption"))) {
    const text = element.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
    if (VIEWER_PROMPTS.has(text) && !element.querySelector("img, picture, video")) {
      element.remove();
    }
  }
}

/** Heading permalinks and code line-number anchors duplicate structure the reader renders. */
function dropStructuralAnchors(root: HTMLElement): void {
  for (const link of Array.from(root.querySelectorAll("h1 a, h2 a, h3 a, h4 a, h5 a, h6 a"))) {
    if (PERMALINK_TEXT.test(link.textContent ?? "")) {
      link.remove();
    }
  }
  for (const link of Array.from(root.querySelectorAll("pre a"))) {
    if (!link.textContent?.trim()) {
      link.remove();
    } else if (link.getAttribute("href")?.startsWith("#")) {
      unwrapElement(link);
    }
  }
}

/**
 * Pass 8. Removes interactive elements and page chrome together with their content (neosanitize
 * would only unwrap them, leaking button labels and form text), keeping quote-attribution footers.
 * Every removal is counted in diagnostics.
 */
export const stripChrome: ArticlePass = (root, context) => {
  dropContentTags(root, context);
  dropCallsToAction(root, context);
  dropViewerPrompts(root);
  dropStructuralAnchors(root);
};
