import { describe, expect, test } from "vitest";
import { getRecapRowLimits, RECAP_ROW_LIMIT_DEFAULTS } from "@modules/inbox/lib/recap/row-limits";

const plenty = { folderCount: 20, savedItemCount: 20, topSourceCount: 20, continueReadingCount: 0 };

describe("recap row limits", () => {
  test("uses the defaults until the rail has been measured", () => {
    expect(getRecapRowLimits({ ...plenty, availableHeight: 0 })).toEqual(RECAP_ROW_LIMIT_DEFAULTS);
  });

  test("shows more rows in a taller rail, and never past the space it has", () => {
    const short = getRecapRowLimits({ ...plenty, availableHeight: 700 });
    const tall = getRecapRowLimits({ ...plenty, availableHeight: 1000 });

    expect(tall.folders + tall.topSources + tall.savedItems).toBeGreaterThan(
      short.folders + short.topSources + short.savedItems,
    );
    // fixed chrome 18 + 2*18 + 3*48 + 52 = 250; rows are 64, 60 and 72 tall.
    const used = 250 + tall.folders * 64 + tall.topSources * 60 + tall.savedItems * 72;
    expect(used).toBeLessThanOrEqual(1000);
  });

  test("shares extra height between cards instead of filling the first", () => {
    const limits = getRecapRowLimits({ ...plenty, availableHeight: 1000 });

    expect(limits.folders).toBeGreaterThan(RECAP_ROW_LIMIT_DEFAULTS.folders - 1);
    expect(limits.topSources).toBeGreaterThanOrEqual(2);
    expect(limits.savedItems).toBeGreaterThanOrEqual(1);
  });

  test("does not ask for more rows than exist", () => {
    const limits = getRecapRowLimits({
      availableHeight: 1400,
      continueReadingCount: 0,
      folderCount: 2,
      savedItemCount: 1,
      topSourceCount: 3,
    });

    expect(limits.folders).toBeLessThanOrEqual(RECAP_ROW_LIMIT_DEFAULTS.folders);
    expect(limits.topSources).toBeLessThanOrEqual(RECAP_ROW_LIMIT_DEFAULTS.topSources);
  });
});
