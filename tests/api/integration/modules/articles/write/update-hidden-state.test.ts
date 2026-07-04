import { describe, expect, mock, test } from "bun:test";
import { updateArticleForUser } from "@modules/articles/write/update";

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

function createFakeDb(existingState?: { hiddenAt: Date | null }) {
  let selectCall = 0;
  const onConflictDoUpdate = mock(() => Promise.resolve());
  const values = mock(() => ({ onConflictDoUpdate }));

  return {
    values,
    onConflictDoUpdate,
    db: {
      select: mock(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: "article-1" }]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve(
                  existingState ? [{ readOverride: null, isSaved: false, ...existingState }] : [],
                ),
            }),
          }),
        };
      }),
      insert: mock(() => ({ values })),
    },
  };
}

describe("updateArticleForUser hidden state", () => {
  test("sets hiddenAt when isHidden is true", async () => {
    const fake = createFakeDb();

    await updateArticleForUser(fake.db as never, "user-1", "article-1", { isHidden: true });

    expect(firstValueInput(fake).hiddenAt).toBeInstanceOf(Date);
    expect(firstConflictSet(fake).hiddenAt).toBeInstanceOf(Date);
  });

  test("clears hiddenAt when isHidden is false", async () => {
    const fake = createFakeDb({ hiddenAt: new Date("2026-07-01T00:00:00.000Z") });

    await updateArticleForUser(fake.db as never, "user-1", "article-1", { isHidden: false });

    expect(firstValueInput(fake).hiddenAt).toBeNull();
    expect(firstConflictSet(fake).hiddenAt).toBeNull();
  });
});
