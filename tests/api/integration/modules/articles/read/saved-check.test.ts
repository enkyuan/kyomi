import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import { checkSavedArticleForUser } from "@modules/articles/read/saved-check";

describe("checkSavedArticleForUser", () => {
  test("returns the matching saved clip before checking feed items", async () => {
    const limit = mock(() =>
      Promise.resolve([
        {
          id: "clip_1",
          title: "Saved clip",
          url: "https://example.com/article",
        },
      ]),
    );
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof checkSavedArticleForUser>[0];

    const result = await checkSavedArticleForUser(fakeDb, "user_1", "https://example.com/article");

    expect(select).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      is_saved: true,
      article: {
        id: "clip_1",
        title: "Saved clip",
        url: "https://example.com/article",
        articleType: "clip",
      },
    });
  });

  test("falls back to saved feed items when no clip exists", async () => {
    let selectCall = 0;
    const select = mock(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        };
      }
      return {
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () =>
                    Promise.resolve([
                      {
                        id: "feed_item_1",
                        title: "Feed hit",
                        url: "https://example.com/article",
                      },
                    ]),
                }),
              }),
            }),
          }),
        }),
      };
    });
    const fakeDb = { select } as unknown as Parameters<typeof checkSavedArticleForUser>[0];

    const result = await checkSavedArticleForUser(fakeDb, "user_1", "https://example.com/article");

    expect(selectCall).toBe(2);
    expect(result).toEqual({
      is_saved: true,
      article: {
        id: "feed_item_1",
        title: "Feed hit",
        url: "https://example.com/article",
        articleType: "feed",
      },
    });
  });

  test("returns false when the url is not saved anywhere", async () => {
    let selectCall = 0;
    const select = mock(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        };
      }
      return {
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve([]),
                }),
              }),
            }),
          }),
        }),
      };
    });
    const fakeDb = { select } as unknown as Parameters<typeof checkSavedArticleForUser>[0];

    const result = await checkSavedArticleForUser(fakeDb, "user_1", "https://example.com/article");

    expect(selectCall).toBe(2);
    expect(result).toEqual({
      is_saved: false,
      article: null,
    });
  });

  test("rejects a blank url", async () => {
    const fakeDb = {} as Parameters<typeof checkSavedArticleForUser>[0];

    await expect(checkSavedArticleForUser(fakeDb, "user_1", "   ")).rejects.toBeInstanceOf(
      AppError,
    );
  });
});
