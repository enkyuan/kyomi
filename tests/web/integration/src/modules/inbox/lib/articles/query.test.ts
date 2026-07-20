import { describe, expect, test } from "vitest";
import {
  buildArticlesUrl,
  buildInboxListUrl,
  normalizeInboxSort,
} from "@modules/inbox/lib/articles/query";

describe("inbox query URLs", () => {
  test("uses subscribed feed articles for My Feed without a day window", () => {
    const url = buildInboxListUrl({
      filter: "my-feed",
      timezoneOffsetMinutes: 300,
      includeRead: false,
      search: undefined,
      cursor: undefined,
      sort: undefined,
    });

    expect(url).toBe("/api/v1/articles?limit=100");
    expect(url).not.toContain("published_after");
    expect(url).not.toContain("/articles/views/all");
  });

  test("maps removed Today and Unread filters to My Feed", () => {
    for (const filter of ["today", "unread"] as const) {
      expect(
        buildInboxListUrl({
          filter,
          timezoneOffsetMinutes: 300,
          includeRead: false,
          search: undefined,
          cursor: undefined,
          sort: undefined,
        }),
      ).toBe("/api/v1/articles?limit=100");
    }
  });

  test("keeps All on the global all-articles view", () => {
    expect(
      buildInboxListUrl({
        filter: "all",
        timezoneOffsetMinutes: 300,
        includeRead: false,
        search: undefined,
        cursor: undefined,
        sort: undefined,
      }),
    ).toBe("/api/v1/articles/views/all?limit=100");
  });

  test("uses folder-scoped feed articles for pinned folder views", () => {
    expect(
      buildArticlesUrl("all", 300, false, undefined, undefined, "folder-1", undefined, undefined),
    ).toBe("/api/v1/articles?folder_id=folder-1&limit=100");
  });

  test("keeps Recent on the recently-read view when searching", () => {
    expect(
      buildInboxListUrl({
        filter: "recent",
        timezoneOffsetMinutes: 300,
        includeRead: false,
        search: " browser ",
        cursor: undefined,
        sort: undefined,
      }),
    ).toBe("/api/v1/articles/views/recently-read?limit=100&search=browser");
  });

  test("uses latest as the default token and migrates legacy newest links", () => {
    expect(normalizeInboxSort("latest")).toBe("latest");
    expect(normalizeInboxSort("newest")).toBe("latest");

    expect(
      buildInboxListUrl({
        filter: "all",
        timezoneOffsetMinutes: 300,
        includeRead: false,
        search: undefined,
        cursor: undefined,
        sort: "latest",
      }),
    ).toBe("/api/v1/articles/views/all?limit=100");
  });
});
