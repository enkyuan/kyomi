import type { ReaderLayoutMode } from "../../core/types";
import { classifyImageAdjacentText, markCaptionedFigures } from "./caption";
import { enhanceArticleBodyImages } from "./image";
import { markReaderMediaAsideLayouts } from "./media";
import {
  markReaderProfileThumbs,
  removeLikelyAuthorCards,
  wrapOrphanedProfileImageParagraphs,
} from "./profile";
import { stripClientCarouselArtifacts } from "./carousel";

export function runReaderCriticalDomEnhancements(container: HTMLElement): void {
  enhanceArticleBodyImages(container);
  markCaptionedFigures(container);
  classifyImageAdjacentText(container);
}

export function runReaderIdleDomEnhancements(
  container: HTMLElement,
  options?: { layoutMode?: ReaderLayoutMode },
): void {
  const layoutMode = options?.layoutMode ?? "normalized";
  if (layoutMode === "fidelity") {
    return;
  }

  stripClientCarouselArtifacts(container);
  removeLikelyAuthorCards(container);
  wrapOrphanedProfileImageParagraphs(container);
  markReaderMediaAsideLayouts(container);
  markReaderProfileThumbs(container);
}

/** Runs client-side reader DOM passes after sanitized HTML is injected. Order matters. */
export function runReaderDomEnhancements(
  container: HTMLElement,
  options?: { layoutMode?: ReaderLayoutMode },
): void {
  const layoutMode = options?.layoutMode ?? "normalized";
  if (layoutMode === "fidelity") {
    runReaderCriticalDomEnhancements(container);
    return;
  }

  runReaderCriticalDomEnhancements(container);
  runReaderIdleDomEnhancements(container, options);
}
