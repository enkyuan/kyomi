import { describe, expect, test } from "vitest";
import {
  buildAuthEntryHref,
  DEFAULT_AUTH_RETURN_TO,
  parseAuthReturnTo,
  preserveAuthEntryHash,
  resolveAuthReturnTo,
  validateAuthSearch,
} from "@modules/auth/redirect";

describe("auth return targets", () => {
  test.each([
    "/inbox",
    "/inbox?filter=saved&itemId=42#reader",
    "/inbox/article-id?filter=all#reader",
  ])("preserves an internal protected target", (target) => {
    expect(parseAuthReturnTo(target)).toBe(target);
    expect(resolveAuthReturnTo(target)).toBe(target);
    expect(validateAuthSearch({ redirect: target })).toEqual({ redirect: target });
  });

  test("encodes the complete target when building an auth entry URL", () => {
    expect(buildAuthEntryHref("/", "/inbox/article?filter=saved#reader")).toBe(
      "/?redirect=%2Finbox%2Farticle%3Ffilter%3Dsaved%23reader",
    );
    expect(buildAuthEntryHref("/register", "https://evil.example/inbox")).toBe("/register");
  });

  test("recovers a protected fragment carried to the auth page by the browser", () => {
    expect(preserveAuthEntryHash("/inbox/article?filter=saved", "#reader")).toBe(
      "/inbox/article?filter=saved#reader",
    );
  });

  test("keeps an encoded target fragment instead of replacing it", () => {
    expect(preserveAuthEntryHash("/inbox/article#comments", "#reader")).toBe(
      "/inbox/article#comments",
    );
  });

  test("does not turn an auth-page fragment into an unvalidated return target", () => {
    expect(preserveAuthEntryHash(undefined, "#reader")).toBeUndefined();
    expect(preserveAuthEntryHash("https://evil.example/inbox", "#reader")).toBeUndefined();
  });

  test.each([
    "https://evil.example/inbox",
    "//evil.example/inbox",
    "/\\evil.example/inbox",
    "javascript:alert(1)",
    "/register",
    "/api/auth/get-session",
    "inbox",
    42,
    null,
  ])("rejects an unsafe or public target", (target) => {
    expect(parseAuthReturnTo(target)).toBeUndefined();
    expect(resolveAuthReturnTo(target)).toBe(DEFAULT_AUTH_RETURN_TO);
    expect(validateAuthSearch({ redirect: target })).toEqual({ redirect: undefined });
  });
});
