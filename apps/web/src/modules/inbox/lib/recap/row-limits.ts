/**
 * How many rows each summary card can show in the height the rail has. Heights are the rendered
 * ones (8px card padding, a 24px header plus 8px under it, rows of 52px with their gap), so a card
 * list ends where the viewport does instead of at a fixed count that wastes a tall window and
 * overflows a short one. Rows are added one card at a time, folders first, so extra space is shared
 * rather than given to the first card.
 */
const LAYOUT_PADDING = 18;
const CARD_GAP = 18;
const CARD_CHROME = 16 + 24 + 8;
const FOLDER_ACTIONS = 12 + 40;
const FOLDER_ROW = 52 + 12;
const SOURCE_ROW = 52 + 8;
const SAVED_ROW = 60 + 12;
const CONTINUE_READING_ROWS = 2;

/** Used until the rail has been measured, and as the floor of every card. */
export const RECAP_ROW_LIMIT_DEFAULTS = { folders: 3, savedItems: 2, topSources: 4 } as const;

const RECAP_ROW_LIMIT_CAPS = { folders: 8, savedItems: 6, topSources: 8 } as const;

export type RecapRowLimits = { folders: number; savedItems: number; topSources: number };

export function getRecapRowLimits({
  availableHeight,
  continueReadingCount,
  folderCount,
  savedItemCount,
  topSourceCount,
}: {
  availableHeight: number;
  continueReadingCount: number;
  folderCount: number;
  savedItemCount: number;
  topSourceCount: number;
}): RecapRowLimits {
  if (availableHeight <= 0) {
    return { ...RECAP_ROW_LIMIT_DEFAULTS };
  }

  const continueRows = Math.min(continueReadingCount, CONTINUE_READING_ROWS);
  const cards = continueRows > 0 ? 4 : 3;
  const fixed =
    LAYOUT_PADDING +
    CARD_GAP * (cards - 1) +
    CARD_CHROME * cards +
    FOLDER_ACTIONS +
    (continueRows > 0 ? continueRows * SAVED_ROW : 0);

  const counts = { folders: 0, savedItems: 0, topSources: 0 };
  const wanted = {
    folders: Math.min(folderCount, RECAP_ROW_LIMIT_CAPS.folders),
    savedItems: Math.min(savedItemCount, RECAP_ROW_LIMIT_CAPS.savedItems),
    topSources: Math.min(topSourceCount, RECAP_ROW_LIMIT_CAPS.topSources),
  };
  const rowHeight = { folders: FOLDER_ROW, savedItems: SAVED_ROW, topSources: SOURCE_ROW };
  let remaining = availableHeight - fixed;

  let added = true;
  while (added) {
    added = false;
    for (const card of ["folders", "topSources", "savedItems"] as const) {
      if (counts[card] < wanted[card] && remaining >= rowHeight[card]) {
        counts[card] += 1;
        remaining -= rowHeight[card];
        added = true;
      }
    }
  }

  // Never fewer rows than the default for a card that has them: a short window scrolls.
  return {
    folders: Math.max(counts.folders, RECAP_ROW_LIMIT_DEFAULTS.folders),
    savedItems: Math.max(counts.savedItems, RECAP_ROW_LIMIT_DEFAULTS.savedItems),
    topSources: Math.max(counts.topSources, RECAP_ROW_LIMIT_DEFAULTS.topSources),
  };
}
