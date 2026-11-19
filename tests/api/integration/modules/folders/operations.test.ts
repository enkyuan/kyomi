import { describe, expect, mock, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import {
  createFolder,
  deleteFolder,
  ensureFolders,
  ensureFoldersByName,
  markFolderReadStatus,
  reorderFolders,
  updateFolder,
} from "@modules/folders/operations";
import { CurrentUser } from "@shared/effect/request";
import { fakeDb, recordingLogger } from "@api-tests/support/layers";

const USER = { userId: "u1" };

/** Run `effect` as user `u1` against a fake drizzle client, on a clock fixed at 2026-07-01. */
function run<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  client: Parameters<typeof fakeDb>[0],
  logs = recordingLogger(),
) {
  const layer = Layer.mergeAll(
    fakeDb(client),
    logs.layer,
    TestClock.layer(),
    Layer.succeed(CurrentUser, USER),
  );
  return Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse("2026-07-01T12:00:00.000Z"));
      return yield* effect;
    }).pipe(Effect.provide(layer)) as Effect.Effect<A, E>,
  );
}

const rejection = <A, E>(promise: Promise<A>) =>
  promise.then(
    () => undefined,
    (error: E) => error,
  );

describe("folders operations", () => {
  test("reorderFolders rejects repeated ids without touching the database", async () => {
    const transaction = mock(() => Promise.resolve());

    const error = await rejection(run(reorderFolders(["f1", "f1"]), { transaction }));

    expect(error).toMatchObject({ _tag: "BadRequest", code: "FOLDER_ORDER_INVALID" });
    expect(transaction).not.toHaveBeenCalled();
  });

  test("reorderFolders rejects an id the user does not own", async () => {
    const tx = {
      select: () => ({ from: () => ({ where: () => Promise.resolve([{ id: "f1" }]) }) }),
      update: mock(() => ({})),
    };
    const transaction = (inner: (client: typeof tx) => Promise<unknown>) => inner(tx);

    const error = await rejection(run(reorderFolders(["f1", "someone-elses"]), { transaction }));

    expect(error).toMatchObject({ _tag: "NotFound", code: "FOLDER_NOT_FOUND" });
    expect(tx.update).not.toHaveBeenCalled();
  });

  test("reorderFolders saves the order in one transaction and returns the new list", async () => {
    const set = mock((_values: Record<string, unknown>) => ({ where: () => Promise.resolve() }));
    const tx = {
      select: () => ({
        from: () => ({ where: () => Promise.resolve([{ id: "f1" }, { id: "f2" }]) }),
      }),
      update: () => ({ set }),
    };
    const createdAt = new Date("2026-06-01T00:00:00.000Z");
    const row = (id: string, name: string) => ({
      id,
      userId: "u1",
      name,
      isPinned: false,
      pinnedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
    const logs = recordingLogger();

    const result = await run(
      reorderFolders(["f2", "f1"]),
      {
        transaction: (inner: (client: typeof tx) => Promise<unknown>) => inner(tx),
        select: () => ({
          from: () => ({
            where: () => ({ orderBy: () => Promise.resolve([row("f2", "B"), row("f1", "A")]) }),
          }),
        }),
      },
      logs,
    );

    expect(set.mock.calls[0]?.[0].updatedAt).toEqual(new Date("2026-07-01T12:00:00.000Z"));
    expect(result.map((folder) => folder.id)).toEqual(["f2", "f1"]);
    expect(logs.entries).toContainEqual({
      level: "info",
      event: "folders.reordered",
      context: { userId: "u1", count: 2 },
    });
  });

  test("createFolder trims, stamps the clock time and returns the inserted folder", async () => {
    const createdAt = new Date("2026-04-01T00:00:00.000Z");
    const values = mock((_row: Record<string, unknown>) => ({
      onConflictDoNothing: () => ({
        returning: () =>
          Promise.resolve([
            {
              id: "550e8400-e29b-41d4-a716-446655440000",
              userId: "u1",
              name: "Inbox",
              isPinned: false,
              pinnedAt: null,
              createdAt,
              updatedAt: createdAt,
            },
          ]),
      }),
    }));
    const logs = recordingLogger();

    const result = await run(createFolder("  Inbox "), { insert: () => ({ values }) }, logs);

    expect(values.mock.calls[0]?.[0]).toMatchObject({
      userId: "u1",
      name: "Inbox",
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
    });
    expect(result.name).toBe("Inbox");
    expect(result.createdAt).toBe("2026-04-01T00:00:00.000Z");
    expect(logs.entries.map((entry) => entry.event)).toEqual(["folders.created"]);
  });

  test("createFolder fails with FOLDER_DUPLICATE (409) when insert returns nothing", async () => {
    const insert = () => ({
      values: () => ({ onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }) }),
    });

    expect(await rejection(run(createFolder("Inbox"), { insert }))).toMatchObject({
      _tag: "Conflict",
      code: "FOLDER_DUPLICATE",
    });
  });

  test("createFolder rejects a blank name", async () => {
    expect(await rejection(run(createFolder("   "), {}))).toMatchObject({
      _tag: "BadRequest",
      code: "FOLDER_NAME_REQUIRED",
    });
  });

  test("a failing statement is a DatabaseError, not a public error", async () => {
    const insert = () => {
      throw new Error("connection reset");
    };

    expect(await rejection(run(createFolder("Inbox"), { insert }))).toMatchObject({
      _tag: "DatabaseError",
      operation: "folders.create",
    });
  });

  test("markFolderReadStatus fails with FOLDER_NOT_FOUND when the folder is missing", async () => {
    const select = () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });

    expect(await rejection(run(markFolderReadStatus("f1"), { select }))).toMatchObject({
      _tag: "NotFound",
      code: "FOLDER_NOT_FOUND",
    });
  });

  test("markFolderReadStatus reports how many subscriptions it marked", async () => {
    let cutoff: unknown;
    const select = () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: "f1" }]) }) }),
    });
    const update = () => ({
      set: (values: Record<string, unknown>) => {
        cutoff = values.lastReadCutoff;
        return {
          where: () => ({ returning: () => Promise.resolve([{ id: "s1" }, { id: "s2" }]) }),
        };
      },
    });

    const result = await run(markFolderReadStatus("f1"), { select, update });

    expect(result).toEqual({
      message: "All articles in folder marked as read",
      folderId: "f1",
      updatedSubscriptions: 2,
    });
    expect(cutoff).toEqual(new Date("2026-07-01T12:00:00.000Z"));
  });

  test("updateFolder pins a folder and returns pinned metadata", async () => {
    const updatedAt = new Date("2026-07-01T12:00:00.000Z");
    let patch: Record<string, unknown> | undefined;
    const update = () => ({
      set: (values: Record<string, unknown>) => {
        patch = values;
        return {
          where: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: "folder-1",
                  userId: "u1",
                  name: "Programming",
                  isPinned: true,
                  pinnedAt: updatedAt,
                  createdAt: new Date("2026-07-01T00:00:00.000Z"),
                  updatedAt,
                },
              ]),
          }),
        };
      },
    });

    const result = await run(updateFolder("folder-1", { isPinned: true }), { update });

    expect(patch?.isPinned).toBe(true);
    expect(patch?.pinnedAt).toEqual(updatedAt);
    expect(result.isPinned).toBe(true);
    expect(result.pinnedAt).toBe("2026-07-01T12:00:00.000Z");
  });

  test("updateFolder unpins a folder", async () => {
    let patch: Record<string, unknown> | undefined;
    const update = () => ({
      set: (values: Record<string, unknown>) => {
        patch = values;
        return {
          where: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: "folder-1",
                  userId: "u1",
                  name: "Programming",
                  isPinned: false,
                  pinnedAt: null,
                  createdAt: new Date("2026-07-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-07-01T12:00:00.000Z"),
                },
              ]),
          }),
        };
      },
    });

    const result = await run(updateFolder("folder-1", { isPinned: false }), { update });

    expect(patch).toMatchObject({ isPinned: false, pinnedAt: null });
    expect(result.isPinned).toBe(false);
    expect(result.pinnedAt).toBeNull();
  });

  test("updateFolder rejects empty patches without touching the database", async () => {
    const update = mock();

    expect(await rejection(run(updateFolder("folder-1", {}), { update }))).toMatchObject({
      _tag: "BadRequest",
      code: "EMPTY_UPDATE",
    });
    expect(update).not.toHaveBeenCalled();
  });

  test("updateFolder fails with FOLDER_NOT_FOUND when no row matches", async () => {
    const update = () => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
    });

    expect(
      await rejection(run(updateFolder("missing", { isPinned: true }), { update })),
    ).toMatchObject({ _tag: "NotFound", code: "FOLDER_NOT_FOUND" });
  });

  test("deleteFolder moves subscriptions to Unsorted before deleting the folder", async () => {
    let selectCall = 0;
    const updateSet = mock((values: Record<string, unknown>) => ({
      values,
      where: () => Promise.resolve(),
    }));
    const deleteWhere = mock(() => Promise.resolve());
    const client = {
      delete: () => ({ where: deleteWhere }),
      insert: () => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve() }) }),
      update: () => ({ set: updateSet }),
      select: () => {
        selectCall += 1;
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve(
                  selectCall === 1
                    ? [{ id: "folder-1", name: "Reading" }]
                    : [
                        {
                          id: "folder-unsorted",
                          userId: "u1",
                          name: "Unsorted",
                          isPinned: false,
                          pinnedAt: null,
                          createdAt: new Date("2026-07-01T00:00:00.000Z"),
                          updatedAt: new Date("2026-07-01T00:00:00.000Z"),
                        },
                      ],
                ),
            }),
          }),
        };
      },
    };
    const logs = recordingLogger();

    await run(deleteFolder("folder-1"), client, logs);

    expect(updateSet.mock.calls[0]?.[0]).toMatchObject({
      folderId: "folder-unsorted",
      updatedAt: new Date("2026-07-01T12:00:00.000Z"),
    });
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(logs.entries.map((entry) => entry.event)).toEqual(["folders.deleted"]);
  });

  test("deleteFolder rejects deleting Unsorted", async () => {
    const update = mock(() => ({ set: mock() }));
    const deleteFrom = mock(() => ({ where: mock() }));
    const select = () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "folder-unsorted", name: "Unsorted" }]),
        }),
      }),
    });

    expect(
      await rejection(run(deleteFolder("folder-unsorted"), { delete: deleteFrom, select, update })),
    ).toMatchObject({ _tag: "BadRequest", code: "DEFAULT_FOLDER_DELETE_FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
    expect(deleteFrom).not.toHaveBeenCalled();
  });
});

describe("ensureFolders", () => {
  /** A drizzle handle whose select returns `rows` and whose inserts are recorded. */
  function handle(rows: Array<{ id: string; name: string }>) {
    const insertValues = mock((_rows: unknown[]) => ({
      onConflictDoNothing: () => Promise.resolve(),
    }));
    const client = {
      insert: () => ({ values: insertValues }),
      select: () => ({ from: () => ({ where: () => Promise.resolve(rows) }) }),
    };
    return { client: client as never, insertValues };
  }

  test("trims, dedupes, and maps every requested name", async () => {
    const { client, insertValues } = handle([
      { id: "folder-1", name: "Tech" },
      { id: "folder-2", name: "News" },
    ]);

    const result = await Effect.runPromise(
      ensureFolders(client, "u1", ["  Tech ", "News", "Tech"]),
    );

    expect(result).toEqual(
      new Map([
        ["Tech", "folder-1"],
        ["News", "folder-2"],
      ]),
    );
    expect(insertValues.mock.calls[0]?.[0]).toHaveLength(2);
  });

  test("returns an empty map without touching the database for no names", async () => {
    const insert = mock(() => {
      throw new Error("must not be called");
    });

    const result = await Effect.runPromise(ensureFolders({ insert } as never, "u1", ["", "   "]));

    expect(result).toEqual(new Map());
    expect(insert).not.toHaveBeenCalled();
  });

  test("rejects a name over the 512-character limit", async () => {
    const { client, insertValues } = handle([]);

    const error = await rejection(
      Effect.runPromise(ensureFolders(client, "u1", ["x".repeat(513)])),
    );

    expect(error).toMatchObject({ _tag: "BadRequest", code: "FOLDER_NAME_TOO_LONG" });
    expect(insertValues).not.toHaveBeenCalled();
  });

  test("batches insert statements at 500 names", async () => {
    const names = Array.from({ length: 501 }, (_, i) => `Folder ${i}`);
    const { client, insertValues } = handle(names.map((name, i) => ({ id: `folder-${i}`, name })));

    const result = await Effect.runPromise(ensureFolders(client, "u1", names));

    expect(insertValues.mock.calls).toHaveLength(2);
    expect(insertValues.mock.calls[0]?.[0]).toHaveLength(500);
    expect(insertValues.mock.calls[1]?.[0]).toHaveLength(1);
    expect(result.size).toBe(501);
  });

  test("fails with FOLDER_CREATE_FAILED when a name never resolves to an id", async () => {
    const { client } = handle([]);

    expect(await rejection(Effect.runPromise(ensureFolders(client, "u1", ["Tech"])))).toMatchObject(
      { _tag: "InternalError", code: "FOLDER_CREATE_FAILED" },
    );
  });

  test("the Promise entry point rejects with the same typed error", async () => {
    const { client } = handle([]);

    expect(await rejection(ensureFoldersByName(client, "u1", ["Tech"]))).toMatchObject({
      code: "FOLDER_CREATE_FAILED",
    });
  });
});
