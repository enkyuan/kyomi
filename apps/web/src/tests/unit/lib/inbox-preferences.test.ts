// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolveInitialInboxPreferences, type InboxPreferences } from "@modules/inbox";

const QUERY_KEY = ["me", "preferences", "inbox", "user_1"] as const;

const SPLIT_PREFERENCES: InboxPreferences = {
  inboxDefaultView: "today",
  inboxDensity: "comfortable",
  articleOpenBehavior: "split",
  inboxMarkReadBehavior: "on-open",
  inboxTimestampDisplay: "absolute",
  inboxTimestampHourCycle: "12h",
  inboxFontSizePx: 16,
  inboxShowRecents: false,
  inboxShowFavicons: true,
};

const READER_PREFERENCES: InboxPreferences = {
  ...SPLIT_PREFERENCES,
  articleOpenBehavior: "reader",
};

describe("resolveInitialInboxPreferences", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key);
        }),
        clear: vi.fn(() => {
          storage.clear();
        }),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  test("prefers loader/server preferences over cached query data", () => {
    const queryClient = {
      getQueryData: () => READER_PREFERENCES,
    } as { getQueryData: <T>() => T | undefined };

    window.localStorage.setItem(
      "vols.rss:inbox-preferences:v2:user_1",
      JSON.stringify(SPLIT_PREFERENCES),
    );

    const resolved = resolveInitialInboxPreferences(
      queryClient as never,
      QUERY_KEY,
      SPLIT_PREFERENCES,
      "user_1",
    );

    expect(resolved.articleOpenBehavior).toBe("split");
  });

  test("prefers loader/server preferences over stale local cache", () => {
    const queryClient = {
      getQueryData: () => undefined,
    } as { getQueryData: <T>() => T | undefined };

    window.localStorage.setItem(
      "vols.rss:inbox-preferences:v2:user_1",
      JSON.stringify(READER_PREFERENCES),
    );

    const resolved = resolveInitialInboxPreferences(
      queryClient as never,
      QUERY_KEY,
      SPLIT_PREFERENCES,
      "user_1",
    );

    expect(resolved.articleOpenBehavior).toBe("split");
  });

  test("falls back to local cache when no loader preferences exist", () => {
    const queryClient = {
      getQueryData: () => undefined,
    } as { getQueryData: <T>() => T | undefined };

    window.localStorage.setItem(
      "vols.rss:inbox-preferences:v2:user_1",
      JSON.stringify(READER_PREFERENCES),
    );

    const resolved = resolveInitialInboxPreferences(
      queryClient as never,
      QUERY_KEY,
      undefined,
      "user_1",
    );

    expect(resolved.articleOpenBehavior).toBe("reader");
  });
});
