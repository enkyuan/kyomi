import { describe, expect, test } from "vitest";
import { buildInboxListUrl } from "@modules/inbox/services/query-urls";

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
});
