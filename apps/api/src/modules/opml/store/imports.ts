import { DateTime, Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { opmlImports } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { Conflict } from "@shared/effect/errors";
import { assertOpmlSourceAdmission } from "../parse";

export type CreateOpmlImportInput = {
  userId: string;
  filename: string;
  sourceUrl?: string | null;
  sourceXml: string;
};

/**
 * The Postgres unique violation raised by the one-active-import-per-user index. Drizzle wraps
 * driver errors in a `DrizzleQueryError` whose `cause` is the `pg` error carrying `constraint`,
 * so walk the cause chain.
 */
function isActiveImportViolation(cause: unknown): boolean {
  for (let current = cause, depth = 0; current instanceof Error && depth < 4; depth += 1) {
    if ("constraint" in current && current.constraint === "opml_imports_one_active_per_user_uidx") {
      return true;
    }
    current = current.cause;
  }
  return false;
}

export const createOpmlImport = Effect.fn("opml.store.create")(function* (
  input: CreateOpmlImportInput,
) {
  const sourceByteLength = yield* assertOpmlSourceAdmission(input.sourceXml);
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  const created = yield* db
    .use("opml.import.create", async (client) => {
      const [row] = await client
        .insert(opmlImports)
        .values({
          id: crypto.randomUUID(),
          userId: input.userId,
          filename: input.filename,
          sourceUrl: input.sourceUrl ?? null,
          sourceXml: input.sourceXml,
          sourceByteLength,
          status: "accepted",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    })
    .pipe(
      Effect.catchIf(
        (error) => isActiveImportViolation(error.cause),
        () =>
          Effect.fail(
            new Conflict({
              message: "An OPML import is already active",
              code: "OPML_IMPORT_ACTIVE",
            }),
          ),
      ),
    );
  if (!created) {
    return yield* Effect.die(new Error("OPML import insert returned no row"));
  }
  return created;
});

export const recordOpmlImportPrepareWakeup = Effect.fn("opml.store.prepare_wakeup")(function* (
  importId: string,
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  yield* db.use("opml.import.prepare_wakeup", (client) =>
    client
      .update(opmlImports)
      .set({ prepareWakeupAt: now, updatedAt: now })
      .where(eq(opmlImports.id, importId)),
  );
});

export type ClaimedOpmlPreparation = {
  importId: string;
  userId: string;
  filename: string;
  sourceXml: string;
};

/** Guarded accepted -> parsing claim. A duplicate prepare wakeup returns null. */
export const claimOpmlPreparation = Effect.fn("opml.store.claim_preparation")(function* (
  importId: string,
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  const [claimed] = yield* db.use("opml.import.claim_preparation", (client) =>
    client
      .update(opmlImports)
      .set({ status: "parsing", startedAt: now, lastHeartbeatAt: now, updatedAt: now })
      .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "accepted")))
      .returning(),
  );

  if (!claimed || claimed.sourceXml === null) {
    return null;
  }
  const preparation: ClaimedOpmlPreparation = {
    importId: claimed.id,
    userId: claimed.userId,
    filename: claimed.filename,
    sourceXml: claimed.sourceXml,
  };
  return preparation;
});

export const recordOpmlPreparationHeartbeat = Effect.fn("opml.store.preparation_heartbeat")(
  function* (importId: string) {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    yield* db.use("opml.import.preparation_heartbeat", (client) =>
      client
        .update(opmlImports)
        .set({ lastHeartbeatAt: now, updatedAt: now })
        .where(eq(opmlImports.id, importId)),
    );
  },
);

/**
 * Records totalItems, opmlTitle, and opmlAuthor once every parsed item is durably materialized.
 * The parent stays in parsing (and sourceXml stays present) so the known-feed matching loop can
 * still run and, if the process crashes here, a stale-parsing reparse can safely resume.
 */
export const recordOpmlImportMaterialized = Effect.fn("opml.store.materialized")(function* (
  importId: string,
  input: { totalItems: number; opmlTitle: string | null; opmlAuthor: string | null },
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  yield* db.use("opml.import.materialized", (client) =>
    client
      .update(opmlImports)
      .set({
        totalItems: input.totalItems,
        opmlTitle: input.opmlTitle,
        opmlAuthor: input.opmlAuthor,
        updatedAt: now,
      })
      .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "parsing"))),
  );
});

/**
 * Atomically clears sourceXml and exits parsing once no known-feed matching work remains:
 * transitions to dispatching when unknown items still need a lease, or straight to completed
 * (or failed, if every item failed) when every item is already terminal.
 */
export const finalizeOpmlImportPreparation = Effect.fn("opml.store.finalize_preparation")(
  function* (importId: string) {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    yield* db.use("opml.import.finalize_preparation", async (client) => {
      const [row] = await client
        .select({
          totalItems: opmlImports.totalItems,
          subscribedItems: opmlImports.subscribedItems,
          alreadySubscribedItems: opmlImports.alreadySubscribedItems,
          failedItems: opmlImports.failedItems,
        })
        .from(opmlImports)
        .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "parsing")))
        .limit(1);
      if (!row) {
        return;
      }

      const completed = row.subscribedItems + row.alreadySubscribedItems + row.failedItems;
      const parsing = and(eq(opmlImports.id, importId), eq(opmlImports.status, "parsing"));
      if (completed < row.totalItems) {
        await client
          .update(opmlImports)
          .set({ status: "dispatching", sourceXml: null, updatedAt: now })
          .where(parsing);
        return;
      }

      await client
        .update(opmlImports)
        .set({
          status: row.failedItems === row.totalItems && row.totalItems > 0 ? "failed" : "completed",
          sourceXml: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(parsing);
    });
  },
);

export const failOpmlImportPreparation = Effect.fn("opml.store.fail_preparation")(function* (
  importId: string,
  error: { code: string; message: string },
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  yield* db.use("opml.import.fail_preparation", (client) =>
    client
      .update(opmlImports)
      .set({
        status: "failed",
        sourceXml: null,
        lastErrorCode: error.code,
        lastErrorMessage: error.message,
        completedAt: now,
        updatedAt: now,
      })
      .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "parsing"))),
  );
});
