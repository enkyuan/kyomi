import type { ReadingStateRow } from "@modules/articles/progress/write";
import type { ArticleListItemDto } from "@modules/articles/types";

/** A reading-state row with the joined article facts the scorer and list mapping need. */
export type ContinueReadingCandidate = {
  reading: ReadingStateRow;
  /** List item fields before `readingProgress` is attached. */
  item: Omit<ArticleListItemDto, "readingProgress">;
  isHidden: boolean;
  isSaved: boolean;
  /** The feed's `viewed_item_count` for this user; null for clips. */
  feedViewedItemCount: number | null;
};
