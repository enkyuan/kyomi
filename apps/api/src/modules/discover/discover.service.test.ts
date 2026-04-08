import { describe, expect, mock, test } from "bun:test";
import { searchFeeds } from "./discover.service";

describe("discover.service", () => {
  test("searchFeeds trims input and maps rows", async () => {
    const limit = mock(() =>
      Promise.resolve([
        {
          id: "feed_1",
          url: "https://example.com/feed.xml",
          title: "Example Feed",
          description: "Latest updates",
          link: "https://example.com",
          isSubscribed: true,
          score: 0,
        },
      ]),
    );
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const leftJoin = mock(() => ({ where }));
    const from = mock(() => ({ leftJoin }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof searchFeeds>[0];

    const result = await searchFeeds(fakeDb, "user_1", "  example  ", 10);

    expect(result).toEqual([
      {
        id: "feed_1",
        url: "https://example.com/feed.xml",
        title: "Example Feed",
        description: "Latest updates",
        link: "https://example.com",
        isSubscribed: true,
      },
    ]);
  });

  test("searchFeeds returns an empty list for blank input", async () => {
    const fakeDb = {} as Parameters<typeof searchFeeds>[0];
    const result = await searchFeeds(fakeDb, "user_1", "   ");
    expect(result).toEqual([]);
  });
});
