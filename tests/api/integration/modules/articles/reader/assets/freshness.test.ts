import { expect, test } from "bun:test";
import { assetLifetime } from "@adapters/assets/freshness";

test("shared cache takes the shortest remaining lifetime and bypasses personalized responses", () => {
  expect(
    assetLifetime(new Headers({ "cache-control": "max-age=3600, s-maxage=60", age: "20" }), 86400),
  ).toBe(40);
  for (const headers of [
    { "cache-control": "public, private" },
    { vary: "Cookie" },
    { "set-cookie": "vary=1" },
    { "cache-control": "no-cache" },
  ]) {
    expect(assetLifetime(new Headers(headers as Record<string, string>), 100)).toBe(0);
  }
});
