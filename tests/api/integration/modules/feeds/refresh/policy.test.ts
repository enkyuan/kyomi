import { describe, expect, test } from "bun:test";
import { shouldEnrichInsertedItems } from "@kyomi/worker/ingestion";

describe("feed refresh policy", () => {
  test("does not enrich scheduled system refreshes by default", () => {
    expect(shouldEnrichInsertedItems({ userId: "system", reason: "scheduled" })).toBe(false);
    expect(shouldEnrichInsertedItems({ userId: "system", reason: "global_scheduled" })).toBe(false);
  });

  test("keeps user-triggered refresh enrichment enabled", () => {
    expect(shouldEnrichInsertedItems({ userId: "user_123", reason: "manual" })).toBe(true);
  });
});
