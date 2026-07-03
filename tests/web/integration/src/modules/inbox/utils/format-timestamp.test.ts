import { afterEach, describe, expect, test, vi } from "vitest";
import { formatInboxTimestamp } from "@modules/inbox";

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);
const HOUR_CYCLE = "12h";

function isoFromNow(offsetMs: number) {
  return new Date(NOW + offsetMs).toISOString();
}

describe("formatInboxTimestamp", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("uses compact relative units through years", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    expect(formatInboxTimestamp(isoFromNow(45_000), "relative", HOUR_CYCLE)).toBe("45s");
    expect(formatInboxTimestamp(isoFromNow(45 * 60_000), "relative", HOUR_CYCLE)).toBe("45m");
    expect(formatInboxTimestamp(isoFromNow(6 * 3_600_000), "relative", HOUR_CYCLE)).toBe("6h");
    expect(formatInboxTimestamp(isoFromNow(6 * 86_400_000), "relative", HOUR_CYCLE)).toBe("6d");
    expect(formatInboxTimestamp(isoFromNow(4 * 7 * 86_400_000), "relative", HOUR_CYCLE)).toBe("4w");
    expect(formatInboxTimestamp(isoFromNow(2 * 30 * 86_400_000), "relative", HOUR_CYCLE)).toBe(
      "2mo",
    );
    expect(formatInboxTimestamp(isoFromNow(18 * 30 * 86_400_000), "relative", HOUR_CYCLE)).toBe(
      "1y",
    );
  });
});
