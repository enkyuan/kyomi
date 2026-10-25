import { formatRemainingMinutes, isContinuingReading } from "@kyomi/reader/core";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

export const CONTINUE_READING_LABEL = "Continue reading";

export type ContinueReadingBadge = {
  readonly isContinuing: boolean;
  /** The badge text, with the time left when it is known. Null when the row shows no badge. */
  readonly label: string | null;
};

/** The Continue reading badge for a list item: an engaged, unfinished article only. */
export function continueReadingBadge(
  item: Pick<ArticleListItemDto, "readingProgress">,
): ContinueReadingBadge {
  if (!isContinuingReading(item.readingProgress)) {
    return { isContinuing: false, label: null };
  }

  const remaining = formatRemainingMinutes(item.readingProgress?.remainingMinutes ?? null);
  return {
    isContinuing: true,
    label: remaining ? `${CONTINUE_READING_LABEL} · ${remaining}` : CONTINUE_READING_LABEL,
  };
}
