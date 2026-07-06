import { normalizeCaptionText } from "./string-prep";
import {
  READER_FIGURE_CAPTION,
  READER_FIGURE_CREDIT,
  READER_FIGURE_HAS_CAPTION,
  READER_IMG_FRAME,
  READER_MEDIA_ASIDE,
  READER_PROFILE_THUMB,
} from "./constants";

function captionTextOverlapsCaption(cap: string, value: string, capExact: Set<string>): boolean {
  if (!value) {
    return false;
  }
  if (capExact.has(value)) {
    return true;
  }
  return cap.indexOf(value) !== -1 || value.indexOf(cap) !== -1;
}

function removeCaptionNoiseChild(child: ChildNode, cap: string, capExact: Set<string>): void {
  if (child.nodeType === Node.TEXT_NODE) {
    const value = normalizeCaptionText(child.textContent ?? "");
    if (captionTextOverlapsCaption(cap, value, capExact)) {
      child.remove();
    }
    return;
  }
  if (child.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const el = child as HTMLElement;
  if (el.tagName === "IMG" || el.querySelector("img")) {
    return;
  }
  const value = normalizeCaptionText(el.textContent ?? "");
  if (captionTextOverlapsCaption(cap, value, capExact)) {
    el.remove();
  }
}

export function dedupeFigureInlineCaptionNoise(container: HTMLElement): void {
  for (const figure of container.querySelectorAll("figure")) {
    const figcaption = figure.querySelector("figcaption");
    if (!figcaption) {
      continue;
    }
    const cap = normalizeCaptionText(figcaption.textContent ?? "");
    if (!cap) {
      continue;
    }
    const capExact = new Set([cap]);
    for (const p of figure.querySelectorAll("p")) {
      if (!p.querySelector("img")) {
        continue;
      }
      for (const child of Array.from(p.childNodes)) {
        removeCaptionNoiseChild(child, cap, capExact);
      }
    }
  }
}

const CREDIT_RE =
  /^(?:(?:photo|image|illustration|picture|video|graphic|source)s?\s*(?:by|courtesy|credit|via|from|:|\/))|(?:(?:getty|ap|reuters|afp|shutterstock|unsplash|pexels|istock|alamy|\u00a9|copyright|\(c\)))/i;

function looksLikeBareCreditLabel(text: string): boolean {
  const compact = text.trim().replace(/\s+/g, " ");
  if (!compact) {
    return false;
  }
  const words = compact.split(" ");
  if (words.length < 2 || words.length > 5) {
    return false;
  }
  if (!words.every((word) => /^[A-Z][a-zA-Z.'-]*$/.test(word))) {
    return false;
  }
  return true;
}

function shouldSkipAdjacentTextFrame(frame: HTMLElement): boolean {
  if (frame.closest("figure")) {
    return true;
  }
  return (
    frame.closest(`[${READER_MEDIA_ASIDE}]`) !== null || frame.hasAttribute(READER_PROFILE_THUMB)
  );
}

function adjacentTextAnchor(frame: HTMLElement): HTMLElement {
  const parent = frame.parentElement;
  if (parent?.tagName === "A") {
    return parent;
  }
  return frame;
}

function isClassifiableAdjacentParagraph(cursor: HTMLElement): boolean {
  if (cursor.tagName !== "P") {
    return false;
  }
  if (
    cursor.hasAttribute(READER_FIGURE_CAPTION) ||
    cursor.hasAttribute(READER_FIGURE_CREDIT) ||
    cursor.hasAttribute(READER_MEDIA_ASIDE)
  ) {
    return false;
  }
  return !cursor.querySelector("img, figure");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function nextParagraphWordCount(cursor: HTMLElement): number {
  const next = cursor.nextElementSibling;
  if (next?.tagName !== "P") {
    return 0;
  }
  const nextText = (next.textContent ?? "").trim();
  return nextText ? countWords(nextText) : 0;
}

function tryMarkAdjacentCredit(
  cursor: HTMLElement,
  text: string,
  wordCount: number,
  classified: number,
): boolean {
  const nextWordCount = nextParagraphWordCount(cursor);
  const isCredit =
    (wordCount <= 20 && CREDIT_RE.test(text)) ||
    (classified === 0 &&
      wordCount <= 5 &&
      looksLikeBareCreditLabel(text) &&
      nextWordCount > 0 &&
      nextWordCount <= 30);
  if (!isCredit) {
    return false;
  }
  cursor.setAttribute(READER_FIGURE_CREDIT, "");
  return true;
}

function tryMarkAdjacentCaption(
  cursor: HTMLElement,
  text: string,
  wordCount: number,
  hasCaption: boolean,
): boolean {
  if (hasCaption || wordCount > 30) {
    return false;
  }
  const sentenceCount = (text.match(/[.!?](?=\s|$)/g) ?? []).length;
  const isStrongCaption = wordCount <= 15;
  const isWeakCaption = wordCount <= 30 && sentenceCount <= 1;
  if (!isStrongCaption && !isWeakCaption) {
    return false;
  }
  cursor.setAttribute(READER_FIGURE_CAPTION, "");
  return true;
}

function classifyAdjacentTextForFrame(frame: HTMLElement): void {
  let cursor = adjacentTextAnchor(frame).nextElementSibling as HTMLElement | null;
  let classified = 0;
  let hasCaption = false;

  while (cursor && classified < 2) {
    if (!isClassifiableAdjacentParagraph(cursor)) {
      break;
    }

    const text = (cursor.textContent ?? "").trim();
    if (!text) {
      cursor = cursor.nextElementSibling as HTMLElement | null;
      continue;
    }

    const wordCount = countWords(text);

    if (tryMarkAdjacentCredit(cursor, text, wordCount, classified)) {
      classified++;
      cursor = cursor.nextElementSibling as HTMLElement | null;
      continue;
    }

    if (tryMarkAdjacentCaption(cursor, text, wordCount, hasCaption)) {
      classified++;
      hasCaption = true;
      cursor = cursor.nextElementSibling as HTMLElement | null;
      continue;
    }

    break;
  }
}

export function classifyImageAdjacentText(container: HTMLElement): void {
  const frames = [...container.querySelectorAll<HTMLElement>(`[${READER_IMG_FRAME}]`)];
  for (const frame of frames) {
    if (shouldSkipAdjacentTextFrame(frame)) {
      continue;
    }
    classifyAdjacentTextForFrame(frame);
  }
}

export function markCaptionedFigures(container: HTMLElement): void {
  for (const figure of container.querySelectorAll<HTMLElement>("figure")) {
    const caption = figure.querySelector<HTMLElement>(":scope > figcaption");
    if (!caption) {
      figure.removeAttribute(READER_FIGURE_HAS_CAPTION);
      continue;
    }

    const captionText = normalizeCaptionText(caption.textContent ?? "");
    if (!captionText) {
      figure.removeAttribute(READER_FIGURE_HAS_CAPTION);
      continue;
    }

    const hasMedia = Boolean(
      figure.querySelector(
        `:scope > [${READER_IMG_FRAME}], :scope > img, :scope > picture, :scope > video, :scope > iframe, :scope > p > [${READER_IMG_FRAME}], :scope > p > img`,
      ),
    );

    if (hasMedia) {
      figure.setAttribute(READER_FIGURE_HAS_CAPTION, "");
    } else {
      figure.removeAttribute(READER_FIGURE_HAS_CAPTION);
    }
  }
}
