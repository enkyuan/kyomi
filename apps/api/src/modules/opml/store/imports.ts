import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { opmlImports } from "@kyomi/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app";
import { decodeOpmlImportCursor, encodeOpmlImportCursor } from "../import-cursor";
import { assertOpmlSourceAdmission } from "../parse";
import type { OpmlImportCounters, OpmlImportStatus } from "../types";

type DB = typeof db;
type OpmlImportRow = typeof opmlImports.$inferSelect;

const OPML_IMPORT_PAGE_DEFAULT_LIMIT = 20;
const OPML_IMPORT_PAGE_MAX_LIMIT = 100;

const ACTIVE_STATUSES = ["accepted", "parsing", "dispatching", "running", "cancelling"] as const;

/** Maps the durable internal state machine to the 5-value status the web client already understands. */
export function toCompatibleOpmlImportStatus(row: OpmlImportRow): OpmlImportStatus {
  switch (row.status) {
    case "accepted":
      return "pending";
    case "parsing":
    case "dispatching":
    case "running":
    case "cancelling":
      return "in_progress";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export type OpmlImportStage = "queued" | "parsing" | "dispatching" | "processing" | "finalizing";

/** Maps the durable internal state machine to the 5-value stage the web client already understands. */
export function toOpmlImportStage(row: OpmlImportRow): OpmlImportStage {
  switch (row.status) {
    case "accepted":
      return "queued";
    case "parsing":
      return "parsing";
    case "dispatching":
      return "dispatching";
    case "running":
      return "processing";
    default:
      return "finalizing";
  }
}

export function buildOpmlImportSummary(row: OpmlImportRow): OpmlImportCounters {
  return {
    totalUrls: row.totalItems,
    completed: row.completedItems,
    subscribed: row.subscribedItems,
    alreadySubscribed: row.alreadySubscribedItems,
    failed: row.failedItems,
    cancelled: row.cancelledItems,
  };
}

export function opmlImportStatusMessage(row: OpmlImportRow): string | null {
  if (row.status === "cancelling") {
    return "Cancellation in progress.";
  }
  return row.lastErrorMessage ?? null;
}

export type CreateOpmlImportInput = {
  userId: string;
  filename: string;
  sourceUrl?: string | null;
  sourceXml: string;
};

export async function createOpmlImport(
  database: DB,
  input: CreateOpmlImportInput,
): Promise<OpmlImportRow> {
  const sourceByteLength = assertOpmlSourceAdmission(input.sourceXml);
  const now = new Date();
  try {
    const [created] = await database
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
    if (!created) {
      throw new Error("OPML import insert returned no row");
    }
    return created;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "constraint" in error &&
      error.constraint === "opml_imports_one_active_per_user_uidx"
    ) {
      throw new AppError("An OPML import is already active", {
        status: 409,
        code: "OPML_IMPORT_ACTIVE",
      });
    }
    throw error;
  }
}

export async function recordOpmlImportPrepareWakeup(database: DB, importId: string): Promise<void> {
  await database
    .update(opmlImports)
    .set({ prepareWakeupAt: new Date(), updatedAt: new Date() })
    .where(eq(opmlImports.id, importId));
}

export type ClaimedOpmlPreparation = {
  importId: string;
  userId: string;
  filename: string;
  sourceXml: string;
};

/** Guarded accepted -> parsing claim. A duplicate prepare wakeup returns null. */
export async function claimOpmlPreparation(
  database: DB,
  importId: string,
): Promise<ClaimedOpmlPreparation | null> {
  const now = new Date();
  const [claimed] = await database
    .update(opmlImports)
    .set({ status: "parsing", startedAt: now, lastHeartbeatAt: now, updatedAt: now })
    .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "accepted")))
    .returning();

  if (!claimed || claimed.sourceXml === null) {
    return null;
  }
  return {
    importId: claimed.id,
    userId: claimed.userId,
    filename: claimed.filename,
    sourceXml: claimed.sourceXml,
  };
}

export async function recordOpmlPreparationHeartbeat(
  database: DB,
  importId: string,
): Promise<void> {
  await database
    .update(opmlImports)
    .set({ lastHeartbeatAt: new Date(), updatedAt: new Date() })
    .where(eq(opmlImports.id, importId));
}

/**
 * Records totalItems, opmlTitle, and opmlAuthor once every parsed item is durably materialized.
 * The parent stays in parsing (and sourceXml stays present) so the known-feed matching loop can
 * still run and, if the process crashes here, a stale-parsing reparse can safely resume.
 */
export async function recordOpmlImportMaterialized(
  database: DB,
  importId: string,
  input: { totalItems: number; opmlTitle: string | null; opmlAuthor: string | null },
): Promise<void> {
  await database
    .update(opmlImports)
    .set({
      totalItems: input.totalItems,
      opmlTitle: input.opmlTitle,
      opmlAuthor: input.opmlAuthor,
      updatedAt: new Date(),
    })
    .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "parsing")));
}

/**
 * Atomically clears sourceXml and exits parsing once no known-feed matching work remains:
 * transitions to dispatching when unknown items still need a lease, or straight to completed
 * (or failed, if every item failed) when every item is already terminal.
 */
export async function finalizeOpmlImportPreparation(database: DB, importId: string): Promise<void> {
  const now = new Date();
  const [row] = await database
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
  if (completed < row.totalItems) {
    await database
      .update(opmlImports)
      .set({ status: "dispatching", sourceXml: null, updatedAt: now })
      .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "parsing")));
    return;
  }

  await database
    .update(opmlImports)
    .set({
      status: row.failedItems === row.totalItems && row.totalItems > 0 ? "failed" : "completed",
      sourceXml: null,
      completedAt: now,
      updatedAt: now,
    })
    .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "parsing")));
}

export async function failOpmlImportPreparation(
  database: DB,
  importId: string,
  error: { code: string; message: string },
): Promise<void> {
  const now = new Date();
  await database
    .update(opmlImports)
    .set({
      status: "failed",
      sourceXml: null,
      lastErrorCode: error.code,
      lastErrorMessage: error.message,
      completedAt: now,
      updatedAt: now,
    })
    .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "parsing")));
}

export async function getOpmlImportForUser(
  database: DB,
  userId: string,
  importId: string,
): Promise<OpmlImportRow | null> {
  const [row] = await database
    .select()
    .from(opmlImports)
    .where(and(eq(opmlImports.id, importId), eq(opmlImports.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getOpmlImportOwner(database: DB, importId: string): Promise<string | null> {
  const [row] = await database
    .select({ userId: opmlImports.userId })
    .from(opmlImports)
    .where(eq(opmlImports.id, importId))
    .limit(1);
  return row?.userId ?? null;
}

export async function listActiveOpmlImportsForUser(
  database: DB,
  userId: string,
): Promise<OpmlImportRow[]> {
  return database
    .select()
    .from(opmlImports)
    .where(and(eq(opmlImports.userId, userId), inArray(opmlImports.status, ACTIVE_STATUSES)))
    .limit(1);
}

export type CancelOpmlImportResult = {
  found: boolean;
  cancelled: boolean;
  status: OpmlImportStatus;
};

/**
 * Guarded transition to cancelling for any user-owned active import; idempotent, and never
 * touches a terminal row. Item-level cancellation batching is added once items exist (Task 8).
 */
export async function requestOpmlImportCancellation(
  database: DB,
  userId: string,
  importId: string,
): Promise<CancelOpmlImportResult> {
  const existing = await getOpmlImportForUser(database, userId, importId);
  if (!existing) {
    return { found: false, cancelled: false, status: "cancelled" };
  }
  if (!ACTIVE_STATUSES.includes(existing.status as (typeof ACTIVE_STATUSES)[number])) {
    return { found: true, cancelled: false, status: toCompatibleOpmlImportStatus(existing) };
  }

  const now = new Date();
  const [updated] = await database
    .update(opmlImports)
    .set({ status: "cancelling", cancelRequestedAt: now, updatedAt: now })
    .where(
      and(
        eq(opmlImports.id, importId),
        eq(opmlImports.userId, userId),
        inArray(opmlImports.status, ACTIVE_STATUSES),
      ),
    )
    .returning();

  if (!updated) {
    const current = await getOpmlImportForUser(database, userId, importId);
    return {
      found: true,
      cancelled: false,
      status: current ? toCompatibleOpmlImportStatus(current) : "cancelled",
    };
  }
  return { found: true, cancelled: true, status: toCompatibleOpmlImportStatus(updated) };
}

export async function deleteTerminalOpmlImport(
  database: DB,
  userId: string,
  importId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(opmlImports)
    .where(
      and(
        eq(opmlImports.id, importId),
        eq(opmlImports.userId, userId),
        inArray(opmlImports.status, ["completed", "failed", "cancelled"]),
      ),
    )
    .returning({ id: opmlImports.id });
  return deleted.length > 0;
}

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
 * the opml_imports_user_created_idx index. Invalid cursors throw AppError
 * OPML_IMPORT_CURSOR_INVALID rather than silently restarting from the newest page.
 */
export async function listOpmlImportsForUser(
  database: DB,
  input: ListOpmlImportsForUserInput,
): Promise<OpmlImportPage> {
  const limit = normalizeOpmlImportPageLimit(input.limit);
  let cursor: { createdAt: string; id: string } | null = null;
  if (input.cursor !== undefined) {
    cursor = decodeOpmlImportCursor(input.cursor);
    if (!cursor) {
      throw new AppError("Invalid import cursor", {
        status: 400,
        code: "OPML_IMPORT_CURSOR_INVALID",
      });
    }
  }

  const cursorCreatedAt = cursor ? new Date(cursor.createdAt) : null;
  const boundary =
    cursor && cursorCreatedAt
      ? or(
          lt(opmlImports.createdAt, cursorCreatedAt),
          and(eq(opmlImports.createdAt, cursorCreatedAt), lt(opmlImports.id, cursor.id)),
        )
      : undefined;

  const rows = await database
    .select()
    .from(opmlImports)
    .where(and(eq(opmlImports.userId, input.userId), boundary))
    .orderBy(desc(opmlImports.createdAt), desc(opmlImports.id))
    .limit(limit + 1);

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
  };
}

const RECONCILE_PREPARE_BATCH = 20;
const RECONCILE_RETENTION_BATCH = 100;

/**
 * Finds up to RECONCILE_PREPARE_BATCH imports needing a fresh prepare wakeup: an accepted import
 * with no wakeup yet or one older than `staleWakeupBefore`, or a parsing import whose heartbeat
 * is older than `staleHeartbeatBefore` (returned to accepted first so it can be reclaimed).
 * Uses FOR UPDATE SKIP LOCKED-equivalent guarded updates so multiple scheduler replicas never
 * republish the same import twice in one pass.
 */
export async function reclaimStalePrepareImports(
  database: DB,
  now: Date,
  staleWakeupBefore: Date,
  staleHeartbeatBefore: Date,
): Promise<string[]> {
  const reclaimedParsing = await database
    .update(opmlImports)
    .set({ status: "accepted", updatedAt: now })
    .where(
      and(
        eq(opmlImports.status, "parsing"),
        or(
          sql`${opmlImports.lastHeartbeatAt} IS NULL`,
          lt(opmlImports.lastHeartbeatAt, staleHeartbeatBefore),
        ),
      ),
    )
    .returning({ id: opmlImports.id });

  const dueForPrepare = await database
    .select({ id: opmlImports.id })
    .from(opmlImports)
    .where(
      and(
        eq(opmlImports.status, "accepted"),
        or(
          sql`${opmlImports.prepareWakeupAt} IS NULL`,
          lt(opmlImports.prepareWakeupAt, staleWakeupBefore),
        ),
      ),
    )
    .limit(RECONCILE_PREPARE_BATCH);

  return dueForPrepare.map((row) => row.id);
}

/** Deletes at most RECONCILE_RETENTION_BATCH terminal imports whose completedAt predates the cutoff. */
export async function deleteOldTerminalOpmlImports(database: DB, olderThan: Date): Promise<number> {
  const candidates = await database
    .select({ id: opmlImports.id })
    .from(opmlImports)
    .where(
      and(
        inArray(opmlImports.status, ["completed", "failed", "cancelled"]),
        lt(opmlImports.completedAt, olderThan),
      ),
    )
    .limit(RECONCILE_RETENTION_BATCH);
  if (candidates.length === 0) {
    return 0;
  }

  const deleted = await database
    .delete(opmlImports)
    .where(
      inArray(
        opmlImports.id,
        candidates.map((row) => row.id),
      ),
    )
    .returning({ id: opmlImports.id });
  return deleted.length;
}

/** Lists imports currently cancelling, for the reconciler to drain via cancelPendingOpmlItems. */
export async function listCancellingOpmlImportIds(database: DB, limit: number): Promise<string[]> {
  const rows = await database
    .select({ id: opmlImports.id })
    .from(opmlImports)
    .where(eq(opmlImports.status, "cancelling"))
    .limit(limit);
  return rows.map((row) => row.id);
}
