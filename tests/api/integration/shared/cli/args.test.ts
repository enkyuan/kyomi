import { describe, expect, test } from "bun:test";
import { positiveIntFlag, valueAfter } from "@shared/cli/args";

describe("valueAfter", () => {
  test("returns the argument that follows the flag", () => {
    expect(valueAfter(["--days", "14", "--limit", "5"], "--days")).toBe("14");
    expect(valueAfter(["--days", "14", "--limit", "5"], "--limit")).toBe("5");
  });

  test("returns null when the flag is absent, last, or followed by another flag", () => {
    expect(valueAfter(["--days", "14"], "--limit")).toBeNull();
    expect(valueAfter(["--days"], "--days")).toBeNull();
    expect(valueAfter(["--apply", "--days", "14"], "--apply")).toBeNull();
    expect(valueAfter(["--days", ""], "--days")).toBeNull();
  });
});

describe("positiveIntFlag", () => {
  test("parses a positive integer and falls back when the flag is absent", () => {
    expect(positiveIntFlag(["--days", "14"], "--days", 7)).toBe(14);
    expect(positiveIntFlag([], "--days", 7)).toBe(7);
    expect(positiveIntFlag(["--days"], "--days", 7)).toBe(7);
  });

  test("rejects a malformed or non-positive value instead of using the fallback", () => {
    expect(() => positiveIntFlag(["--days", "abc"], "--days", 7)).toThrow(
      "Invalid --days value: abc",
    );
    expect(() => positiveIntFlag(["--days", "0"], "--days", 7)).toThrow("Invalid --days value: 0");
    expect(() => positiveIntFlag(["--days", "-3"], "--days", 7)).toThrow(
      "Invalid --days value: -3",
    );
  });
});
