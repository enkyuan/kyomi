import type { ScrollMetrics } from "@kyomi/reader/core";

/** Marks the article body wrapper; the value is the article id so an exiting article never matches. */
export const READER_BODY_ATTRIBUTE = "data-reader-body";

/** The reader's end-of-content tolerance, in px, for sub-pixel layout rounding. */
const END_OF_CONTENT_TOLERANCE_PX = 2;

export type BodyMetrics = ScrollMetrics & {
  /** The article body's bottom edge has entered the viewport. */
  endVisible: boolean;
};

export function findReaderBody(viewport: HTMLElement, itemId: string): HTMLElement | null {
  const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(itemId) : itemId;
  return viewport.querySelector<HTMLElement>(`[${READER_BODY_ATTRIBUTE}="${escaped}"]`);
}

/** The vertical translation applied by animated ancestors between `element` and `viewport`. */
function ancestorTranslateY(viewport: HTMLElement, element: HTMLElement): number {
  if (typeof DOMMatrixReadOnly === "undefined") {
    return 0;
  }
  let offset = 0;
  for (let node = element.parentElement; node && node !== viewport; node = node.parentElement) {
    const { transform } = getComputedStyle(node);
    if (transform && transform !== "none") {
      offset += new DOMMatrixReadOnly(transform).m42;
    }
  }
  return offset;
}

/**
 * Measures the viewport and the article body. The body is whatever renderer fills the wrapper, so
 * this works for the HTML path and for a later KDM renderer. Returns null while the body is not
 * laid out. The enter animation's translation is removed so the offsets are layout positions.
 */
export function measureReaderBody(viewport: HTMLElement, itemId: string): BodyMetrics | null {
  const body = findReaderBody(viewport, itemId);
  if (!body) {
    return null;
  }
  const contentHeight = body.offsetHeight;
  if (contentHeight <= 0) {
    return null;
  }

  const scrollTop = viewport.scrollTop;
  const viewportHeight = viewport.clientHeight;
  const contentTop =
    body.getBoundingClientRect().top -
    viewport.getBoundingClientRect().top +
    scrollTop -
    ancestorTranslateY(viewport, body);

  return {
    scrollTop,
    viewportHeight,
    contentTop,
    contentHeight,
    endVisible:
      scrollTop + viewportHeight >= contentTop + contentHeight - END_OF_CONTENT_TOLERANCE_PX,
  };
}
