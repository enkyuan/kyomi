import { describe, expect, test } from "bun:test";
import { parseFeedAdminUserIds } from "@modules/feeds/admin/allowlist";

describe("parseFeedAdminUserIds", () => {
  test("returns empty for undefined or blank", () => {
    expect(parseFeedAdminUserIds(undefined)).toEqual([]);
    expect(parseFeedAdminUserIds("")).toEqual([]);
    expect(parseFeedAdminUserIds("  ")).toEqual([]);
  });

  test("splits trims and drops empties", () => {
    expect(parseFeedAdminUserIds(" a , b , ")).toEqual(["a", "b"]);
  });
});
