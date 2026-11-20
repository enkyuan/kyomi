import { describe, expect, test } from "bun:test";
import { sha256Hex } from "@modules/articles/reader/translations/hash";

describe("article translation content hash", () => {
  test("is stable for identical source content", async () => {
    const first = await sha256Hex("Kyomi organizes your feeds.");
    const second = await sha256Hex("Kyomi organizes your feeds.");

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  test("changes when source content changes", async () => {
    const english = await sha256Hex("Kyomi organizes your feeds.");
    const spanish = await sha256Hex("Kyomi organiza tus feeds.");

    expect(english).not.toBe(spanish);
  });
});
