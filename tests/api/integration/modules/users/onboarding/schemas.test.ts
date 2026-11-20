import { expect, test } from "bun:test";
import { patch } from "@modules/users/onboarding/schemas";
import { starterBundles as bundles } from "@kyomi/ingest/ingestion/starter-bundles";
import { TakenUsernames } from "@modules/users/onboarding/usernames";

test("drafts accept individual fields and report invalid selections", () => {
  expect(patch.parse({ username: " @Kyomi_User " })).toEqual({ username: "kyomi_user" });
  expect(patch.parse({ bundleIds: ["design", "climate", "culture", "business"] })).toEqual({
    bundleIds: ["design", "climate", "culture", "business"],
  });
  for (const invalid of [
    {},
    { userId: "someone" },
    { name: " " },
    { name: "a\u0000b" },
    { username: "@@name" },
    { language: "en US" },
    { language: "zz" },
    { categories: [] },
    { categories: ["Other"] },
    { categories: ["Technology"] },
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

test("the Bloom cache serves only fresh database-confirmed usernames", () => {
  const cache = new TakenUsernames();
  expect(cache.has("reader_123", 0)).toBe(false);
  cache.add("reader_123", 1000);
  expect(cache.has("reader_123", 15999)).toBe(true);
  expect(cache.has("reader_456", 15999)).toBe(false);
  expect(cache.has("reader_123", 16000)).toBe(false);
});
