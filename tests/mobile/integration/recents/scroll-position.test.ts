import { describe, expect, test } from "bun:test";
import {
  getRecentHistoryInitialOffset,
  resetRecentHistoryScroll,
} from "../../../../apps/mobile/src/modules/recents/lib/scroll-position";

describe("recent history scroll position", () => {
  test("uses the native negative inset position for an iOS list at rest", () => {
    expect(getRecentHistoryInitialOffset(96, true)).toBe(-96);
    expect(getRecentHistoryInitialOffset(96, false)).toBe(0);
  });

  test("resets the native scroll view without Legend List's logical-offset clamp", () => {
    const calls: Array<{ animated: boolean; x: number; y: number }> = [];

    resetRecentHistoryScroll(
      { scrollTo: (options) => calls.push(options) },
      getRecentHistoryInitialOffset(96, true),
    );

    expect(calls).toEqual([{ animated: false, x: 0, y: -96 }]);
  });
});
