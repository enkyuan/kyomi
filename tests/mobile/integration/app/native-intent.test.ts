import { describe, expect, test } from "bun:test";
import { redirectSystemPath } from "../../../../apps/mobile/src/app/+native-intent";

const OAUTH_REDIRECT = "kyomi://oauth/callback?code=abc&state=xyz";
const MAX_PATH_LENGTH = 2048;

describe("native intent routing", () => {
  test("leaves the OAuth redirect to AuthSession while the app is running", () => {
    expect(redirectSystemPath({ path: OAUTH_REDIRECT, initial: false })).toBeNull();
  });

  test("starts at the root when a cold launch carries a stale OAuth redirect", () => {
    expect(redirectSystemPath({ path: OAUTH_REDIRECT, initial: true })).toBe("/");
  });

  test.each(["kyomi://settings", "kyomi://oauth/callbacks?code=abc", "/explore"])(
    "routes %s unchanged",
    (path) => {
      expect(redirectSystemPath({ path, initial: false })).toBe(path);
    },
  );

  test("accepts a link at the length limit and rejects one past it", () => {
    const atLimit = `kyomi://explore?q=${"a".repeat(MAX_PATH_LENGTH - "kyomi://explore?q=".length)}`;

    expect(atLimit).toHaveLength(MAX_PATH_LENGTH);
    expect(redirectSystemPath({ path: atLimit, initial: false })).toBe(atLimit);
    expect(redirectSystemPath({ path: `${atLimit}a`, initial: false })).toBeNull();
  });

  // expo-router decodes every percent escape with a quadratic decoder, so a long escaped path is
  // a denial of service unless it is dropped before the router sees it.
  test.each([
    ["a long run of escapes", `kyomi://explore?q=${"%E0%A4%A".repeat(50_000)}`],
    ["a long path", `/${"a".repeat(1_000_000)}`],
    ["a long query string", `kyomi://explore?${"a=1&".repeat(100_000)}`],
  ])("drops %s while the app is running", (_name, path) => {
    expect(redirectSystemPath({ path, initial: false })).toBeNull();
  });

  test("starts at the root when a cold launch carries an oversized link", () => {
    expect(
      redirectSystemPath({ path: `kyomi://explore?q=${"%41".repeat(10_000)}`, initial: true }),
    ).toBe("/");
  });

  test("drops an oversized look-alike of the OAuth redirect instead of passing it on", () => {
    const path = `${OAUTH_REDIRECT}&padding=${"a".repeat(MAX_PATH_LENGTH)}`;

    expect(redirectSystemPath({ path, initial: false })).toBeNull();
    expect(redirectSystemPath({ path, initial: true })).toBe("/");
  });
});
