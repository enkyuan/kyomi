import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { parseSessionsResponse } from "@modules/settings/hooks/session-api";
import { describeSessionDevice } from "@modules/settings/hooks/session-device";
import { formatRelativeTimestamp, formatTimestamp } from "@modules/settings/hooks/session-format";
import { describeSessionLocation } from "@modules/settings/hooks/session-location";

describe("account session helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("formats invalid and relative timestamps", () => {
    expect(formatTimestamp("not-a-date")).toEqual({ absolute: "Unknown", relative: "Unknown" });
    expect(formatRelativeTimestamp("2026-07-01T11:59:00.000Z")).toBe("1 minute ago");
  });

  test("describes browser and operating system from user agent", () => {
    const device = describeSessionDevice(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
    );

    expect(device.label).toBe("Chrome on macOS");
    expect(device.fullUserAgent).toContain("Chrome/125.0");
  });

  test("describes localhost locations", () => {
    expect(describeSessionLocation({ locationLabel: null, ipAddress: "127.0.0.1" })).toBe(
      "Localhost",
    );
  });

  test("parses session responses with nullable defaults and non-current status", () => {
    expect(
      parseSessionsResponse([
        {
          id: "session-1",
          token: "token-1",
          updatedAt: "2026-07-01T12:00:00.000Z",
          expiresAt: "2026-08-01T12:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        id: "session-1",
        token: "token-1",
        ipAddress: null,
        userAgent: null,
        updatedAt: "2026-07-01T12:00:00.000Z",
        expiresAt: "2026-08-01T12:00:00.000Z",
        locationLabel: null,
        locationCity: null,
        locationRegion: null,
        locationCountry: null,
        isCurrent: false,
      },
    ]);
  });
});
