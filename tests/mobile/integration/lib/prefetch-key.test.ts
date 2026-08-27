import { describe, expect, test } from "bun:test";
import { mobileApiPrefetchKey } from "../../../../apps/mobile/src/lib/prefetch-key";

describe("mobile API prefetch keys", () => {
  test("uses the complete API path so distinct query variants cannot share a response", () => {
    const initial = "/api/v1/articles/views/all?limit=100&sort=latest";
    const nextPage = "/api/v1/articles/views/all?limit=100&sort=latest&cursor=next";

    expect(mobileApiPrefetchKey(initial)).toBe(`mobile-api:${initial}`);
    expect(mobileApiPrefetchKey(nextPage)).not.toBe(mobileApiPrefetchKey(initial));
  });

  test("keeps encoded article identifiers distinct", () => {
    expect(mobileApiPrefetchKey("/api/v1/articles/a%2Fb")).not.toBe(
      mobileApiPrefetchKey("/api/v1/articles/a/b"),
    );
  });
});
