import type { ArticlePass, CompileContext } from "../context";
import { LAYOUT_ADAPTERS } from "./layout-adapters";

export const PLACEMENT_ATTR = "data-kyomi-placement";
export const GALLERY_ATTR = "data-kyomi-gallery";
export const MEDIA_TEXT_ATTR = "data-kyomi-media-text";
export const CALLOUT_ATTR = "data-kyomi-callout";
export const ROLE_ATTR = "data-kyomi-role";

const WIDE = /^(?:alignwide|kg-width-wide|is-style-wide|wide|width-wide|media-wide|image-wide)$/i;
const FULL =
  /^(?:alignfull|kg-width-full|is-style-full|full-bleed|fullbleed|full-width|width-full)$/i;
const START = /^(?:alignleft|float-left|pull-left|image-left|align-left|left)$/i;
const END = /^(?:alignright|float-right|pull-right|image-right|align-right|right)$/i;

/** Elements that carry author intent about their own width. */
const PLACEABLE = "figure, img, video, iframe, table, pre, blockquote, div, picture, aside";

const GALLERY_SELECTOR = [
  ".wp-block-gallery",
  ".blocks-gallery-grid",
  "div.gallery",
  ".kg-gallery-card",
  ".kg-gallery-container",
  ".image-gallery-embed",
  "[class~='gallery']",
].join(",");
const CAROUSEL_CLASS = /(?:carousel|slider|slideshow|swiper|slick|glide)/i;

const CALLOUT_SELECTOR = [
  ".admonition",
  ".theme-admonition",
  ".markdown-alert",
  ".callout",
  ".alert",
  ".kg-callout-card",
  "[role='note']",
  "[role='alert']",
].join(",");
const CALLOUT_TITLE_SELECTOR =
  ".admonition-title, .markdown-alert-title, .callout-title, [class*='admonitionHeading']";

const VARIANT_BY_TOKEN: Record<string, "note" | "tip" | "important" | "warning" | "caution"> = {
  note: "note",
  info: "note",
  abstract: "note",
  summary: "note",
  tldr: "note",
  todo: "note",
  example: "note",
  quote: "note",
  question: "note",
  help: "note",
  faq: "note",
  seealso: "note",
  tip: "tip",
  hint: "tip",
  success: "tip",
  check: "tip",
  done: "tip",
  important: "important",
  warning: "warning",
  warn: "warning",
  attention: "warning",
  caution: "caution",
  danger: "caution",
  error: "caution",
  failure: "caution",
  fail: "caution",
  bug: "caution",
  missing: "caution",
};

const PULLQUOTE_SELECTOR =
  ".wp-block-pullquote, .pullquote, .pull-quote, .kg-blockquote-alt, blockquote.pullquote";
const CAPTION_SELECTOR =
  ".wp-caption-text, .wp-element-caption, .image-caption, .photo-caption, p.caption, div.caption, span.caption";
const CREDIT_SELECTOR = ".credit, .photo-credit, .image-credit, .wp-block-image__credit";
const FOOTNOTES_SELECTOR = [
  ".footnotes",
  ".wp-block-footnotes",
  ".footnote-list",
  ".footnotes-list",
  "[role='doc-endnotes']",
  "section[id*='footnote']",
  "section[id*='endnote']",
].join(",");
const FOOTNOTE_SELECTOR = ".footnote, .footnote-definition, .footnote-item, [role='doc-footnote']";
const SIDENOTE_SELECTOR = ".sidenote, .marginnote, .margin-note, .sidenote-content, aside.sidenote";

function classTokens(element: Element): string[] {
  return (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function placementOf(element: Element): "wide" | "full" | "start" | "end" | null {
  const tokens = classTokens(element);
  if (tokens.some((token) => FULL.test(token))) {
    return "full";
  }
  if (tokens.some((token) => WIDE.test(token))) {
    return "wide";
  }
  if (tokens.some((token) => START.test(token))) {
    return "start";
  }
  if (tokens.some((token) => END.test(token))) {
    return "end";
  }
  if (element.tagName === "IMG") {
    const align = element.getAttribute("align")?.toLowerCase();
    return align === "left" ? "start" : align === "right" ? "end" : null;
  }
  return null;
}

function setOnce(element: Element, name: string, value: string): void {
  if (!element.hasAttribute(name)) {
    element.setAttribute(name, value);
  }
}

function capturePlacement(root: HTMLElement): void {
  for (const element of Array.from(root.querySelectorAll(PLACEABLE))) {
    const placement = placementOf(element);
    if (placement) {
      setOnce(element, PLACEMENT_ATTR, placement);
    }
  }
}

function captureGalleries(root: HTMLElement): void {
  for (const element of Array.from(root.querySelectorAll(GALLERY_SELECTOR))) {
    // Only the outermost gallery wrapper: Ghost nests container, row, and image classes.
    if (element.parentElement?.closest(GALLERY_SELECTOR)?.hasAttribute(GALLERY_ATTR)) {
      continue;
    }
    if (element.querySelectorAll("img").length < 2) {
      continue;
    }
    const carousel = CAROUSEL_CLASS.test(element.getAttribute("class") ?? "");
    setOnce(element, GALLERY_ATTR, carousel ? "carousel" : "grid");
  }
}

function captureMediaText(root: HTMLElement): void {
  for (const element of Array.from(root.querySelectorAll(".wp-block-media-text"))) {
    const reversed = classTokens(element).includes("has-media-on-the-right");
    setOnce(element, MEDIA_TEXT_ATTR, reversed ? "end" : "start");
  }
}

function calloutVariant(element: Element): "note" | "tip" | "important" | "warning" | "caution" {
  const tokens = classTokens(element).flatMap((token) => token.toLowerCase().split(/[-_]/));
  for (const token of tokens) {
    const variant = VARIANT_BY_TOKEN[token];
    if (variant) {
      return variant;
    }
  }
  return "note";
}

function captureCallouts(root: HTMLElement): void {
  for (const element of Array.from(root.querySelectorAll(CALLOUT_SELECTOR))) {
    if (element.hasAttribute(CALLOUT_ATTR) || element.closest("pre, code")) {
      continue;
    }
    // `.alert` and role=note/alert are weak signals: require some content and no headings.
    if (!element.textContent?.trim() || element.querySelector("h1, h2, h3")) {
      continue;
    }
    element.setAttribute(CALLOUT_ATTR, calloutVariant(element));
    const title = element.querySelector(CALLOUT_TITLE_SELECTOR);
    if (title) {
      setOnce(title, ROLE_ATTR, "callout-title");
    }
  }
}

function setRole(root: HTMLElement, selector: string, role: string, skip?: Element[]): void {
  for (const element of Array.from(root.querySelectorAll(selector))) {
    if (!skip?.includes(element)) {
      setOnce(element, ROLE_ATTR, role);
    }
  }
}

function captureRoles(root: HTMLElement): void {
  setRole(root, PULLQUOTE_SELECTOR, "pullquote");
  setRole(root, CAPTION_SELECTOR, "caption");
  setRole(root, CREDIT_SELECTOR, "credit");
  setRole(root, SIDENOTE_SELECTOR, "sidenote");

  const containers = Array.from(root.querySelectorAll(FOOTNOTES_SELECTOR));
  setRole(root, FOOTNOTES_SELECTOR, "footnotes");
  // A single definition (Substack `div.footnote`) is not itself a container of definitions.
  for (const element of Array.from(root.querySelectorAll(FOOTNOTE_SELECTOR))) {
    if (!containers.includes(element) && !element.closest("[data-kyomi-role='footnotes']")) {
      setOnce(element, ROLE_ATTR, "footnote");
    }
  }
}

/**
 * Pass 7. Reads publisher classes and markup that the sanitizer is about to remove (WordPress
 * `alignwide` and `wp-block-gallery`, Ghost `kg-width-*`, MkDocs admonitions, Tufte sidenotes,
 * footnote containers) into compiler-owned `data-kyomi-*` hints, then runs the publisher adapters
 * for markup that needs rewriting rather than labelling.
 */
export const captureLayout: ArticlePass = (root, context: CompileContext) => {
  for (const adapter of LAYOUT_ADAPTERS) {
    if (adapter.matches(root, context)) {
      adapter.apply(root, context);
    }
  }
  capturePlacement(root);
  captureGalleries(root);
  captureMediaText(root);
  captureCallouts(root);
  captureRoles(root);
};
