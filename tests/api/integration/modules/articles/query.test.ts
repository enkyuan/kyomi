import { describe, expect, test } from "bun:test";
import { parseArticlesListQuery, parseMergedViewListQuery } from "@modules/articles/query";

describe("article sort query migration", () => {
  test("uses latest as the canonical and default sort token", () => {
    expect(parseArticlesListQuery({ sort: "latest" }).sort).toBe("latest");
    expect(parseArticlesListQuery({}).sort).toBe("latest");
    expect(parseMergedViewListQuery({ sort: "latest" }).sort).toBe("latest");
  });

  test("normalizes the legacy newest token to latest", () => {
    expect(parseArticlesListQuery({ sort: "newest" }).sort).toBe("latest");
    expect(parseMergedViewListQuery({ sort: "newest" }).sort).toBe("latest");
  });
});
