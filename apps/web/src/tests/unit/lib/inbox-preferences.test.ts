// @vitest-environment jsdom

import { afterEach, describe, expect, test } from "vitest";
import type { InboxPreferences } from "@lib/inbox-preferences";
import { resolveInitialInboxPreferences } from "@lib/inbox-preferences";

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
  afterEach(() => {
    window.localStorage.clear();
  });

  test("prefers cached query data over all other sources", () => {
    const queryClient = {
      getQueryData: () => READER_PREFERENCES,
    } as { getQueryData: <T>() => T | undefined };

    window.localStorage.setItem(
      "cronos:inbox-preferences:v2:user_1",
      JSON.stringify(SPLIT_PREFERENCES),
    );

    const resolved = resolveInitialInboxPreferences(
      queryClient as never,
      QUERY_KEY,
      SPLIT_PREFERENCES,
      "user_1",
    );

    expect(resolved.articleOpenBehavior).toBe("reader");
  });

  test("prefers loader/server preferences over stale local cache", () => {
    const queryClient = {
      getQueryData: () => undefined,
    } as { getQueryData: <T>() => T | undefined };

    window.localStorage.setItem(
      "cronos:inbox-preferences:v2:user_1",
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
      "cronos:inbox-preferences:v2:user_1",
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
