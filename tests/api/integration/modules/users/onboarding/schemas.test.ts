import { expect, test } from "bun:test";
import { patch } from "@modules/users/onboarding/schemas";
import { bundles } from "@modules/users/onboarding/options";

test("drafts accept individual fields and report invalid selections", () => {
  expect(patch.parse({ username: " @Kyomi_User " })).toEqual({ username: "kyomi_user" });
  for (const invalid of [
    {},
    { userId: "someone" },
    { name: " " },
    { name: "a\u0000b" },
    { username: "@@name" },
    { language: "en US" },
    { categories: [] },
    { categories: ["Other"] },
    { bundleIds: ["custom"] },
    { bundleIds: ["science", "science"] },
  ])
    expect(patch.safeParse(invalid).success).toBe(false);
  for (const bundle of bundles) {
    const urls = new Set(bundle.feeds.map((feed) => feed.url));
    expect(urls.size).toBe(bundle.feeds.length);
    expect(urls.size).toBeGreaterThanOrEqual(4);
    expect(urls.size).toBeLessThanOrEqual(6);
  }
});
