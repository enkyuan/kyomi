import { describe, expect, test } from "bun:test";
import { isValidEmail, normalizeEmail } from "@/lib/email";

describe("email validation", () => {
  test("accepts common addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  test("rejects obvious invalid input", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(normalizeEmail("bad")).toBe(null);
  });
});
