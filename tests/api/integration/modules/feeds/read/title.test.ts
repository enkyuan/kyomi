import { describe, expect, test } from "bun:test";
import { displayFeedTitle } from "@modules/feeds/read/title";

describe("displayFeedTitle", () => {
  test("uses global when custom is nullish", () => {
    expect(displayFeedTitle("Global", null)).toBe("Global");
    expect(displayFeedTitle("Global", undefined)).toBe("Global");
  });

  test("uses custom when non-empty", () => {
    expect(displayFeedTitle("Global", "  My  ")).toBe("My");
  });

  test("falls back when custom is blank", () => {
    expect(displayFeedTitle("Global", "   ")).toBe("Global");
    expect(displayFeedTitle("Global", "")).toBe("Global");
  });
});
