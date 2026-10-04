import { describe, expect, test } from "bun:test";
import { redirectSystemPath } from "../../../../apps/mobile/src/app/+native-intent";

const OAUTH_REDIRECT = "kyomi://oauth/callback?code=abc&state=xyz";

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
});
