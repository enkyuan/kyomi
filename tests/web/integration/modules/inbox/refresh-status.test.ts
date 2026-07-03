import { describe, expect, test } from "vitest";
import { hasActiveFeedRefresh } from "@modules/inbox/queries/options";

describe("active feed refresh status", () => {
  test("treats queued and running feeds as active", () => {
    expect(hasActiveFeedRefresh([{ refreshStatus: "queued" }])).toBe(true);
    expect(hasActiveFeedRefresh([{ refreshStatus: "running" }])).toBe(true);
  });

  test("does not treat terminal or missing statuses as active", () => {
    expect(
      hasActiveFeedRefresh([
        { refreshStatus: "idle" },
        { refreshStatus: "failed" },
        { refreshStatus: null },
        {},
      ]),
    ).toBe(false);
    expect(hasActiveFeedRefresh(undefined)).toBe(false);
  });
});
