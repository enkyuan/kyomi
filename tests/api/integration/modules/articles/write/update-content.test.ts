import { describe, expect, mock, test } from "bun:test";
import { Cause, Effect, Exit, Layer } from "effect";
import { updateArticleForUser, updateArticleOrClipForUser } from "@modules/articles/write/update";
import { fakeDb, fakeQueue, silentLogger } from "@api-tests/support/layers";

/**
 * `feed_items` rows are shared by every subscriber. A signed-in user (sign-up is open) must not be
 * able to rewrite one through `PUT /articles/:articleId`, only their own read, saved and hidden
 * state. The fake database serves: no clip owned by the caller, then the feed item, then no
 * previous state.
 */
function createFakeDb() {
  let selectCall = 0;
  const update = mock(() => ({ set: () => ({ where: () => Promise.resolve() }) }));
  const onConflictDoUpdate = mock(() => Promise.resolve());
  const values = mock(() => ({ onConflictDoUpdate }));
  const rowsFor = (call: number) => (call === 2 ? [{ id: "article-1", feedId: "feed-1" }] : []);

  return {
    update,
    values,
    layer: Layer.mergeAll(
      fakeQueue(),
      silentLogger,
      fakeDb({
        select: () => {
          selectCall += 1;
          const rows = rowsFor(selectCall);
          return { from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) };
        },
        update,
        insert: () => ({ values }),
      }),
    ),
  };
}

async function failure(effect: Effect.Effect<unknown, unknown, never>) {
  const exit = await Effect.runPromiseExit(effect);
  expect(Exit.isFailure(exit)).toBe(true);
  return Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;
}

describe("updating a feed item", () => {
  test.each([
    { contentHtml: `<p>phish</p><a href="https://evil.example">sign in</a>` },
    { contentText: "replaced" },
    { contentMarkdown: "[x](https://evil.example)" },
    { contentStatus: "ready" },
    { contentSource: "feed_html" },
    { extractionErrorCode: "x" },
    { extractionErrorMessage: "x" },
  ])("refuses a body edit by a user who does not own the item: %o", async (body) => {
    const fake = createFakeDb();

    const error = await failure(
      updateArticleOrClipForUser("user-1", "article-1", body).pipe(Effect.provide(fake.layer)),
    );

    expect(error).toMatchObject({ _tag: "Forbidden", code: "ARTICLE_CONTENT_READ_ONLY" });
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.values).not.toHaveBeenCalled();
  });

  test("refuses the whole update when a body edit comes with a state change", async () => {
    const fake = createFakeDb();

    const error = await failure(
      updateArticleOrClipForUser("user-1", "article-1", {
        isRead: true,
        contentHtml: "<p>phish</p>",
      }).pipe(Effect.provide(fake.layer)),
    );

    expect(error).toMatchObject({ _tag: "Forbidden" });
    expect(fake.values).not.toHaveBeenCalled();
  });

  test("still saves the user's own read, saved and hidden state", async () => {
    const fake = createFakeDb();

    await Effect.runPromise(
      updateArticleOrClipForUser("user-1", "article-1", {
        isRead: true,
        isSaved: true,
        isHidden: false,
      }).pipe(Effect.provide(fake.layer)),
    );

    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.values).toHaveBeenCalledTimes(1);
    expect(fake.values.mock.calls[0]).toMatchObject([
      { userId: "user-1", feedItemId: "article-1", readOverride: true, isSaved: true },
    ]);
  });

  test("the feed update itself ignores body fields that reach it directly", async () => {
    const fake = createFakeDb();

    const error = await failure(
      updateArticleForUser("user-1", "article-1", { contentText: "replaced" }).pipe(
        Effect.provide(fake.layer),
      ),
    );

    expect(error).toMatchObject({ _tag: "BadRequest", code: "EMPTY_UPDATE" });
    expect(fake.update).not.toHaveBeenCalled();
  });
});
