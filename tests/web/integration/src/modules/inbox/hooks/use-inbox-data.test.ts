// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  resolveInitialInboxPreferences,
  type InboxPreferences,
} from "@modules/inbox/hooks/use-inbox-data";
import { INBOX_PREFERENCES_STORAGE_KEY } from "@lib/shell/keys";
import { sanitizeInboxPreferences } from "@modules/inbox/lib/preferences";

const QUERY_KEY = ["me", "preferences", "inbox", "user_1"] as const;

const SPLIT_PREFERENCES: InboxPreferences = {
  inboxDefaultView: "my-feed",
  inboxDensity: "comfortable",
  articleOpenBehavior: "split",
  inboxMarkReadBehavior: "on-open",
  inboxTimestampDisplay: "relative",
  inboxTimestampHourCycle: "12h",
  inboxFontSizePx: 16,
  inboxShowFavicons: true,
};

const READER_PREFERENCES: InboxPreferences = {
  ...SPLIT_PREFERENCES,
  articleOpenBehavior: "reader",
};
const ABSOLUTE_TIMESTAMP_PREFERENCES: InboxPreferences = {
  ...READER_PREFERENCES,
  inboxTimestampDisplay: "absolute",
};
const TIMESTAMP_DISPLAY_USER_SET_KEY = `${INBOX_PREFERENCES_STORAGE_KEY}:timestamp-display-user-set`;

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
      "kyomi:inbox-preferences:v4:user_1",
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
      "kyomi:inbox-preferences:v4:user_1",
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
      "kyomi:inbox-preferences:v4:user_1",
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

  test("maps legacy absolute timestamp loader preferences to the relative default", () => {
    const queryClient = {
      getQueryData: () => undefined,
    } as { getQueryData: <T>() => T | undefined };

    const resolved = resolveInitialInboxPreferences(
      queryClient as never,
      QUERY_KEY,
      ABSOLUTE_TIMESTAMP_PREFERENCES,
      "user_1",
    );

    expect(resolved.inboxTimestampDisplay).toBe("relative");
  });

  test("preserves absolute timestamp loader preferences after an explicit current choice", () => {
    const queryClient = {
      getQueryData: () => undefined,
    } as { getQueryData: <T>() => T | undefined };

    window.localStorage.setItem(`${TIMESTAMP_DISPLAY_USER_SET_KEY}:user_1`, "1");

    const resolved = resolveInitialInboxPreferences(
      queryClient as never,
      QUERY_KEY,
      ABSOLUTE_TIMESTAMP_PREFERENCES,
      "user_1",
    );

    expect(resolved.inboxTimestampDisplay).toBe("absolute");
  });

  test("maps legacy absolute timestamp cache preferences to the relative default", () => {
    const queryClient = {
      getQueryData: () => undefined,
    } as { getQueryData: <T>() => T | undefined };

    window.localStorage.setItem(
      "kyomi:inbox-preferences:v4:user_1",
      JSON.stringify(ABSOLUTE_TIMESTAMP_PREFERENCES),
    );

    const resolved = resolveInitialInboxPreferences(
      queryClient as never,
      QUERY_KEY,
      undefined,
      "user_1",
    );

    expect(resolved.inboxTimestampDisplay).toBe("relative");
  });

  test("ignores stale v3 cache so absolute timestamps do not override defaults", () => {
    const queryClient = {
      getQueryData: () => undefined,
    } as { getQueryData: <T>() => T | undefined };

    window.localStorage.setItem(
      "kyomi:inbox-preferences:v3:user_1",
      JSON.stringify({
        ...READER_PREFERENCES,
        inboxTimestampDisplay: "absolute",
      }),
    );

    const resolved = resolveInitialInboxPreferences(
      queryClient as never,
      QUERY_KEY,
      undefined,
      "user_1",
    );

    expect(resolved.inboxTimestampDisplay).toBe("relative");
  });

  test("maps removed default views to My Feed", () => {
    for (const inboxDefaultView of ["today", "unread"] as const) {
      expect(sanitizeInboxPreferences({ ...SPLIT_PREFERENCES, inboxDefaultView })).toMatchObject({
        inboxDefaultView: "my-feed",
      });
    }
  });
});
