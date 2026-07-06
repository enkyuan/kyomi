import { READER_IMG_FRAME, READER_MEDIA_ASIDE, READER_PROFILE_THUMB } from "./constants";
import { hasOnlyElementOrWhitespace, isLikelyTextOrLinkParagraph } from "./utils";

const SOCIAL_LINK_RE =
  /(?:^|\.)x\.com$|twitter\.com$|linkedin\.com$|facebook\.com$|instagram\.com$/i;

const PROFILE_IMG_CLASS_RE =
  /avatar|headshot|profile|photo|gravatar|author-img|authorimage|contributor|columnist/i;

const AUTHOR_TEXT_RE =
  /\b(?:is a (?:reporter|journalist|writer|editor|correspondent|columnist|contributor|analyst|producer|author))|(?:has (?:written|reported|covered) (?:about|on|for))|(?:(?:editor|author|contributor|columnist|reporter|correspondent) (?:at|for|of)\b)|(?:lives in\b)|(?:follow (?:them|her|him|me) on\b)/i;

function looksLikePersonName(text: string): boolean {
  const compact = text.trim().replace(/\s+/g, " ");
  if (!compact || compact.length > 60) {
    return false;
  }
  const words = compact.split(" ");
  if (words.length < 2 || words.length > 4) {
    return false;
  }
  if (!words.every((w) => /^[A-Z][a-zA-Z.'-]+$/.test(w))) {
    return false;
  }
  return true;
}

export function removeLikelyAuthorCards(container: HTMLElement): void {
  const blocks = container.querySelectorAll<HTMLElement>("div, section, article, figure");
  for (const block of blocks) {
    if (block.querySelectorAll("img").length === 0) {
      continue;
    }
    const links = Array.from(block.querySelectorAll("a[href]"));
    if (links.length === 0) {
      continue;
    }
    const socialLinks = links.filter((a) => {
      try {
        const href = a.getAttribute("href");
        if (!href) {
          return false;
        }
        return SOCIAL_LINK_RE.test(new URL(href).hostname);
      } catch {
        return false;
      }
    });
    if (socialLinks.length < 2) {
      continue;
    }
    const text = (block.textContent ?? "").replace(/\s+/g, " ").trim();
    const wordCount = text ? text.split(" ").length : 0;
    const looksAuthor =
      /\b(author|editor|writer|journalist|columnist|contributor|lives in|follow)\b/i.test(text) ||
      looksLikePersonName(text);
    if (looksAuthor && wordCount > 0 && wordCount <= 120) {
      block.remove();
    }
  }
}

function isLikelyAuthorBlockHost(frame: HTMLElement): boolean {
  return Boolean(
    frame.closest(
      [
        ".author-bio",
        ".media-object",
        ".byline",
        ".wp-block-author",
        "[class*='author-bio']",
        "[class*='author-box']",
        "[class*='author-card']",
        "[class*='contributor']",
        "[class*='bio-wrapper']",
        "[class*='byline-block']",
        "[class*='profile']",
      ].join(", "),
    ),
  );
}

function tryMarkProfileThumb(
  frame: HTMLElement,
  img: HTMLImageElement,
  orderedFrames: HTMLElement[],
): void {
  if (frame.closest(`[${READER_MEDIA_ASIDE}]`)) {
    return;
  }
  if (frame.hasAttribute(READER_PROFILE_THUMB)) {
    return;
  }

  const viaClass = PROFILE_IMG_CLASS_RE.test(img.className ?? "");
  const viaHost = isLikelyAuthorBlockHost(frame);
  const isLastFrame = orderedFrames.length > 0 && orderedFrames[orderedFrames.length - 1] === frame;

  const viaAdjacentText = (() => {
    const parent = frame.parentElement;
    if (!parent) return false;
    let cursor = frame.nextElementSibling ?? parent.nextElementSibling;
    for (let i = 0; i < 3 && cursor; i++) {
      const text = (cursor.textContent ?? "").trim();
      if (text && (AUTHOR_TEXT_RE.test(text) || looksLikePersonName(text))) return true;
      cursor = cursor.nextElementSibling;
    }
    return false;
  })();

  if (viaClass || viaHost || viaAdjacentText) {
    frame.setAttribute(READER_PROFILE_THUMB, "");
    return;
  }

  const applyIntrinsic = (): void => {
    if (frame.hasAttribute(READER_PROFILE_THUMB) || frame.closest(`[${READER_MEDIA_ASIDE}]`)) {
      return;
    }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w > 0 && h > 0 && isLastFrame && orderedFrames.length >= 2) {
      const maxD = Math.max(w, h);
      const minD = Math.min(w, h);
      if (maxD <= 520 && minD > 0 && maxD / minD < 2.75) {
        frame.setAttribute(READER_PROFILE_THUMB, "");
      }
    }
  };

  if (img.complete) {
    applyIntrinsic();
  } else {
    img.addEventListener("load", applyIntrinsic, { once: true });
  }
}

export function markReaderProfileThumbs(container: HTMLElement): void {
  const orderedFrames = [...container.querySelectorAll<HTMLElement>(`[${READER_IMG_FRAME}]`)];
  for (const frame of orderedFrames) {
    const img = frame.querySelector("img");
    if (!img) {
      continue;
    }
    tryMarkProfileThumb(frame, img, orderedFrames);
  }
}

function shouldSkipOrphanProfileWrap(frame: HTMLElement): boolean {
  return (
    frame.closest(`[${READER_MEDIA_ASIDE}]`) !== null || frame.hasAttribute(READER_PROFILE_THUMB)
  );
}

function resolveOrphanProfileWrapAnchor(
  frame: HTMLElement,
): { anchor: HTMLElement; host: HTMLElement } | null {
  let anchor: HTMLElement = frame;
  const frameParent = frame.parentElement;
  if (
    frameParent &&
    frameParent.tagName === "P" &&
    hasOnlyElementOrWhitespace(frameParent, frame)
  ) {
    anchor = frameParent;
  } else if (
    frameParent?.tagName === "A" &&
    frameParent.parentElement?.tagName === "P" &&
    hasOnlyElementOrWhitespace(frameParent, frame)
  ) {
    anchor = frameParent.parentElement!;
  }

  const host = anchor.parentElement;
  if (!host) {
    return null;
  }
  return { anchor, host };
}

function collectOrphanProfileTextSiblings(anchor: HTMLElement): HTMLElement[] {
  const textSiblings: HTMLElement[] = [];
  let cursor = anchor.nextElementSibling as HTMLElement | null;
  while (cursor && textSiblings.length < 2) {
    if (cursor.tagName !== "P") {
      break;
    }
    if (!isLikelyTextOrLinkParagraph(cursor)) {
      break;
    }
    textSiblings.push(cursor);
    cursor = cursor.nextElementSibling as HTMLElement | null;
  }
  return textSiblings;
}

function hasOrphanProfileAuthorSignals(frame: HTMLElement, textSiblings: HTMLElement[]): boolean {
  const img = frame.querySelector("img");
  if (PROFILE_IMG_CLASS_RE.test(img?.className ?? "") || isLikelyAuthorBlockHost(frame)) {
    return true;
  }
  return textSiblings.some((sib) => AUTHOR_TEXT_RE.test((sib.textContent ?? "").trim()));
}

function wrapOrphanProfileBlock(
  host: HTMLElement,
  anchor: HTMLElement,
  textSiblings: HTMLElement[],
  frame: HTMLElement,
): void {
  const wrapper = document.createElement("div");
  wrapper.setAttribute(READER_MEDIA_ASIDE, "");
  host.insertBefore(wrapper, anchor);
  wrapper.appendChild(anchor);
  for (const sib of textSiblings) {
    wrapper.appendChild(sib);
  }
  frame.setAttribute(READER_PROFILE_THUMB, "");
}

function tryWrapOrphanedProfileImageParagraph(frame: HTMLElement): void {
  if (shouldSkipOrphanProfileWrap(frame)) {
    return;
  }

  const resolved = resolveOrphanProfileWrapAnchor(frame);
  if (!resolved) {
    return;
  }

  const { anchor, host } = resolved;
  const textSiblings = collectOrphanProfileTextSiblings(anchor);
  if (textSiblings.length === 0 || !hasOrphanProfileAuthorSignals(frame, textSiblings)) {
    return;
  }

  wrapOrphanProfileBlock(host, anchor, textSiblings, frame);
}

export function wrapOrphanedProfileImageParagraphs(container: HTMLElement): void {
  const frames = [...container.querySelectorAll<HTMLElement>(`[${READER_IMG_FRAME}]`)];
  for (const frame of frames) {
    tryWrapOrphanedProfileImageParagraph(frame);
  }
}
