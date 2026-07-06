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

/** Runs client-side reader DOM passes after sanitized HTML is injected. Order matters. */
export function runReaderDomEnhancements(
  container: HTMLElement,
  options?: { layoutMode?: ReaderLayoutMode },
): void {
  const layoutMode = options?.layoutMode ?? "normalized";
  if (layoutMode === "fidelity") {
    enhanceArticleBodyImages(container);
    markCaptionedFigures(container);
    classifyImageAdjacentText(container);
    return;
  }

  stripClientCarouselArtifacts(container);
  removeLikelyAuthorCards(container);
  enhanceArticleBodyImages(container);
  markCaptionedFigures(container);
  wrapOrphanedProfileImageParagraphs(container);
  markReaderMediaAsideLayouts(container);
  markReaderProfileThumbs(container);
  classifyImageAdjacentText(container);
}
