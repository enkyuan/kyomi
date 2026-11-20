import { DateTime, Effect } from "effect";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { opmlImports } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { BadRequest } from "@shared/effect/errors";
import { decodeOpmlImportCursor, encodeOpmlImportCursor } from "../cursor/import";
import type { OpmlImportStatus } from "../types";
import { toCompatibleOpmlImportStatus } from "./status";

type OpmlImportRow = typeof opmlImports.$inferSelect;

const OPML_IMPORT_PAGE_DEFAULT_LIMIT = 20;
const OPML_IMPORT_PAGE_MAX_LIMIT = 100;

const ACTIVE_STATUSES = ["accepted", "parsing", "dispatching", "running", "cancelling"] as const;

export const getOpmlImportForUser = Effect.fn("opml.store.get_for_user")(function* (
  userId: string,
  importId: string,
) {
  const db = yield* Db;
  const [row] = yield* db.use("opml.import.get_for_user", (client) =>
    client
      .select()
      .from(opmlImports)
      .where(and(eq(opmlImports.id, importId), eq(opmlImports.userId, userId)))
      .limit(1),
  );
  return row ?? null;
});

export const getOpmlImportOwner = Effect.fn("opml.store.get_owner")(function* (importId: string) {
  const db = yield* Db;
  const [row] = yield* db.use("opml.import.get_owner", (client) =>
    client
      .select({ userId: opmlImports.userId })
      .from(opmlImports)
      .where(eq(opmlImports.id, importId))
      .limit(1),
  );
  return row?.userId ?? null;
});

export const listActiveOpmlImportsForUser = Effect.fn("opml.store.list_active")(function* (
  userId: string,
) {
  const db = yield* Db;
  return yield* db.use("opml.import.list_active", (client) =>
    client
      .select()
      .from(opmlImports)
      .where(and(eq(opmlImports.userId, userId), inArray(opmlImports.status, ACTIVE_STATUSES)))
      .limit(1),
  );
});

export type CancelOpmlImportResult = {
  found: boolean;
  cancelled: boolean;
  status: OpmlImportStatus;
};

/**
 * Guarded transition to cancelling for any user-owned active import; idempotent, and never
 * touches a terminal row. Item-level cancellation runs separately in `cancelPendingOpmlItems`.
 */
export const requestOpmlImportCancellation = Effect.fn("opml.store.request_cancellation")(
  function* (userId: string, importId: string) {
    const db = yield* Db;
    const now = yield* DateTime.nowAsDate;
    const existing = yield* getOpmlImportForUser(userId, importId);
    if (!existing) {
      return {
        found: false,
        cancelled: false,
        status: "cancelled",
      } satisfies CancelOpmlImportResult;
    }
    if (!ACTIVE_STATUSES.includes(existing.status as (typeof ACTIVE_STATUSES)[number])) {
      return {
        found: true,
        cancelled: false,
        status: toCompatibleOpmlImportStatus(existing),
      } satisfies CancelOpmlImportResult;
    }

    const [updated] = yield* db.use("opml.import.request_cancellation", (client) =>
      client
        .update(opmlImports)
        .set({ status: "cancelling", cancelRequestedAt: now, updatedAt: now })
        .where(
          and(
            eq(opmlImports.id, importId),
            eq(opmlImports.userId, userId),
            inArray(opmlImports.status, ACTIVE_STATUSES),
          ),
        )
        .returning(),
    );

    if (!updated) {
      const current = yield* getOpmlImportForUser(userId, importId);
      return {
        found: true,
        cancelled: false,
        status: current ? toCompatibleOpmlImportStatus(current) : "cancelled",
      } satisfies CancelOpmlImportResult;
    }
    return {
      found: true,
      cancelled: true,
      status: toCompatibleOpmlImportStatus(updated),
    } satisfies CancelOpmlImportResult;
  },
);

export const deleteTerminalOpmlImport = Effect.fn("opml.store.delete_terminal")(function* (
  userId: string,
  importId: string,
) {
  const db = yield* Db;
  const deleted = yield* db.use("opml.import.delete_terminal", (client) =>
    client
      .delete(opmlImports)
      .where(
        and(
          eq(opmlImports.id, importId),
          eq(opmlImports.userId, userId),
          inArray(opmlImports.status, ["completed", "failed", "cancelled"]),
        ),
      )
      .returning({ id: opmlImports.id }),
  );
  return deleted.length > 0;
});

export type ListOpmlImportsForUserInput = {
  userId: string;
  limit?: number;
  cursor?: string;
};

export type OpmlImportPage = {
  items: OpmlImportRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

function normalizeOpmlImportPageLimit(limit: number | undefined): number {
  return Math.min(Math.max(1, limit ?? OPML_IMPORT_PAGE_DEFAULT_LIMIT), OPML_IMPORT_PAGE_MAX_LIMIT);
}

/**
 * Keyset-paginates a user's imports newest first, ordered by (createdAt DESC, id DESC) using
 * the opml_imports_user_created_idx index. An invalid cursor fails with `BadRequest`
 * OPML_IMPORT_CURSOR_INVALID rather than silently restarting from the newest page.
 */
export const listOpmlImportsForUser = Effect.fn("opml.store.list_for_user")(function* (
  input: ListOpmlImportsForUserInput,
) {
  const db = yield* Db;
  const limit = normalizeOpmlImportPageLimit(input.limit);
  const cursor = input.cursor === undefined ? null : decodeOpmlImportCursor(input.cursor);
  if (input.cursor !== undefined && !cursor) {
    return yield* new BadRequest({
      message: "Invalid import cursor",
      code: "OPML_IMPORT_CURSOR_INVALID",
    });
  }

  const cursorCreatedAt = cursor ? new Date(cursor.createdAt) : null;
  const boundary =
    cursor && cursorCreatedAt
      ? or(
          lt(opmlImports.createdAt, cursorCreatedAt),
          and(eq(opmlImports.createdAt, cursorCreatedAt), lt(opmlImports.id, cursor.id)),
        )
      : undefined;

  const rows = yield* db.use("opml.import.list_for_user", (client) =>
    client
      .select()
      .from(opmlImports)
      .where(and(eq(opmlImports.userId, input.userId), boundary))
      .orderBy(desc(opmlImports.createdAt), desc(opmlImports.id))
      .limit(limit + 1),
  );

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page,
    nextCursor:
      hasMore && last
        ? encodeOpmlImportCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null,
    hasMore,
  } satisfies OpmlImportPage;
});
