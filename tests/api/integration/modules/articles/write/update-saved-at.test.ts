import { describe, expect, mock, test } from "bun:test";
import { Effect, Layer } from "effect";
import { updateArticleForUser } from "@modules/articles/write/update";
import { fakeDb, fakeQueue, silentLogger } from "@api-tests/support/layers";

function firstValueInput(fake: ReturnType<typeof createFakeDb>): Record<string, unknown> {
  const call = fake.values.mock.calls[0] as unknown as [Record<string, unknown>] | undefined;
  expect(call).toBeDefined();
  return call![0];
}

function firstConflictSet(fake: ReturnType<typeof createFakeDb>): Record<string, unknown> {
  const call = fake.onConflictDoUpdate.mock.calls[0] as unknown as
    | [{ set: Record<string, unknown> }]
    | undefined;
  expect(call).toBeDefined();
  return call![0].set;
}

function createFakeDb(existingState?: { isSaved: boolean; savedAt: Date | null }) {
  let selectCall = 0;
  const onConflictDoUpdate = mock(() => Promise.resolve());
  const values = mock(() => ({ onConflictDoUpdate }));

  return {
    values,
    onConflictDoUpdate,
    layer: Layer.mergeAll(
      fakeQueue(),
      silentLogger,
      fakeDb({
        select: mock(() => {
          selectCall += 1;
          if (selectCall === 1) {
            return {
              from: () => ({
                where: () => ({
                  limit: () => Promise.resolve([{ id: "article-1", feedId: "feed-1" }]),
                }),
              }),
            };
          }
          return {
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve(
                    existingState ? [{ readOverride: null, hiddenAt: null, ...existingState }] : [],
                  ),
              }),
            }),
          };
        }),
        insert: mock(() => ({ values })),
      }),
    ),
  };
}

describe("updateArticleForUser saved aging state", () => {
  test("sets savedAt when save transitions from false to true", async () => {
    const fake = createFakeDb({ isSaved: false, savedAt: null });

    await Effect.runPromise(
      updateArticleForUser("user-1", "article-1", { isSaved: true }).pipe(
        Effect.provide(fake.layer),
      ),
    );

    expect(firstValueInput(fake).isSaved).toBe(true);
    expect(firstValueInput(fake).savedAt).toBeInstanceOf(Date);
    expect(firstConflictSet(fake).savedAt).toBeInstanceOf(Date);
  });

  test("preserves savedAt when saving an already saved article", async () => {
    const savedAt = new Date("2026-06-01T00:00:00.000Z");
    const fake = createFakeDb({ isSaved: true, savedAt });

    await Effect.runPromise(
      updateArticleForUser("user-1", "article-1", { isSaved: true }).pipe(
        Effect.provide(fake.layer),
      ),
    );

    expect(firstValueInput(fake).savedAt).toBe(savedAt);
    expect(firstConflictSet(fake).savedAt).toBe(savedAt);
  });

  test("clears savedAt when unsaving an article", async () => {
    const fake = createFakeDb({
      isSaved: true,
      savedAt: new Date("2026-06-01T00:00:00.000Z"),
    });

    await Effect.runPromise(
      updateArticleForUser("user-1", "article-1", { isSaved: false }).pipe(
        Effect.provide(fake.layer),
      ),
    );

    expect(firstValueInput(fake).isSaved).toBe(false);
    expect(firstValueInput(fake).savedAt).toBeNull();
    expect(firstConflictSet(fake).savedAt).toBeNull();
  });
});
