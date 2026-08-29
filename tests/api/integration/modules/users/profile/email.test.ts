import { describe, expect, test } from "bun:test";
import { normalizeEmail } from "@modules/users/profile/email";

describe("email normalization", () => {
  test("normalizes common addresses", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  test("rejects invalid input", () => {
    expect(normalizeEmail("bad")).toBe(null);
  });
});
