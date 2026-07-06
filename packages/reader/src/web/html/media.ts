import { READER_IMG_FRAME, READER_MEDIA_ASIDE } from "./constants";

/** Avoid treating a whole article wrapper (hero image + many blocks) as a single media row. */
const MEDIA_ASIDE_MAX_DIRECT_CHILDREN = 8;

function isMediaLeadingElement(el: Element): boolean {
  if (el.matches(`[${READER_IMG_FRAME}]`)) {
    return true;
  }
  if (el.tagName === "FIGURE" && el.querySelector(`img, [${READER_IMG_FRAME}]`)) {
    return true;
  }
  if (el.tagName === "A" && el.querySelector(`[${READER_IMG_FRAME}]`)) {
    return true;
  }
  return false;
}

function markReaderMediaAsideElement(el: HTMLElement): void {
  if (el.closest(`[${READER_MEDIA_ASIDE}]`)) {
    return;
  }
  el.setAttribute(READER_MEDIA_ASIDE, "");
}

export function markReaderMediaAsideLayouts(container: HTMLElement): void {
  const classHints = container.querySelectorAll<HTMLElement>(
    [
      ".wp-block-media-text",
      ":is(div, section, article).author-bio",
      ":is(div, section, article).media-object",
    ].join(","),
  );
  for (const el of classHints) {
    const n = el.children.length;
    if (n < 2 || n > MEDIA_ASIDE_MAX_DIRECT_CHILDREN) {
      continue;
    }
    if (!isMediaLeadingElement(el.children[0]!)) {
      continue;
    }
    markReaderMediaAsideElement(el);
  }

  const structuralHosts = container.querySelectorAll<HTMLElement>(":is(div, section, article)");
  for (const el of structuralHosts) {
    if (el.closest(`[${READER_MEDIA_ASIDE}]`)) {
      continue;
    }
    if (el.children.length !== 2) {
      continue;
    }
    const first = el.children[0]!;
    const second = el.children[1]!;
    if (!isMediaLeadingElement(first)) {
      continue;
    }
    const secondTag = second.tagName;
    if (secondTag !== "DIV" && secondTag !== "SECTION" && secondTag !== "ARTICLE") {
      continue;
    }
    markReaderMediaAsideElement(el);
  }
}
