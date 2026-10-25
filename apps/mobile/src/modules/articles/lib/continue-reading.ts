import { formatRemainingMinutes, isContinuingReading } from "@kyomi/reader/core";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

export const CONTINUE_READING_LABEL = "Continue reading";

export type ContinueReadingBadge = {
  readonly isContinuing: boolean;
  /** The time left, such as "6m left". Null when unknown or when the row shows no badge. */
  readonly remaining: string | null;
  /** The badge text: the time left, or "Continue reading" when it is unknown. Null with no badge. */
  readonly label: string | null;
  /** The badge read aloud, which names the action the visible time left leaves out. */
  readonly accessibilityLabel: string | null;
};

/** The Continue reading badge for a list item: an engaged, unfinished article only. */
export function continueReadingBadge(
  item: Pick<ArticleListItemDto, "readingProgress">,
): ContinueReadingBadge {
  if (!isContinuingReading(item.readingProgress)) {
    return { accessibilityLabel: null, isContinuing: false, label: null, remaining: null };
  }

  const remaining = formatRemainingMinutes(item.readingProgress?.remainingMinutes ?? null);
  return {
    accessibilityLabel: remaining
      ? `${CONTINUE_READING_LABEL}, ${remaining}`
      : CONTINUE_READING_LABEL,
    isContinuing: true,
    label: remaining ?? CONTINUE_READING_LABEL,
    remaining,
  };
}
