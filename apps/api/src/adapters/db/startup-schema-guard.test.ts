import { describe, expect, test } from "bun:test";
import { findMissingRequiredTables } from "./startup-schema-guard";

describe("findMissingRequiredTables", () => {
  test("returns missing sentinel tables", () => {
    expect(findMissingRequiredTables(["users", "feeds"])).toEqual(["sessions", "memberships"]);
  });

  test("returns an empty list when all sentinel tables are present", () => {
    expect(findMissingRequiredTables(["users", "sessions", "feeds", "memberships"])).toEqual([]);
  });
});
