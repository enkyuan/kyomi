import { describe, expect, test } from "bun:test";
import { escapeLikePattern, searchPattern } from "@modules/articles/search-filter";

describe("article search filter helpers", () => {
  test("escapes LIKE wildcards and backslashes", () => {
    expect(escapeLikePattern(String.raw`100%_match\path`)).toBe(
      String.raw`100\%\_match\\path`,
    );
  });

  test("returns undefined for blank search and wraps nonblank search", () => {
    expect(searchPattern("   ")).toBeUndefined();
    expect(searchPattern(" browser ")).toBe("%browser%");
  });
});
