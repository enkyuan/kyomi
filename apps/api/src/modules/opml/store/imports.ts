import { and, eq, inArray } from "drizzle-orm";
import { opmlImports } from "@kyomi/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app";
import { assertOpmlSourceAdmission } from "../parse";
import type { OpmlImportCounters, OpmlImportStatus } from "../types";

type DB = typeof db;
type OpmlImportRow = typeof opmlImports.$inferSelect;

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
 * Clears sourceXml and transitions parsing -> dispatching once every parsed item is durably
 * materialized. Records totalItems, opmlTitle, and opmlAuthor alongside the transition.
 */
export async function finalizeOpmlImportPreparation(
  database: DB,
  importId: string,
  input: { totalItems: number; opmlTitle: string | null; opmlAuthor: string | null },
): Promise<void> {
  const now = new Date();
  await database
    .update(opmlImports)
    .set({
      status: "dispatching",
      sourceXml: null,
      totalItems: input.totalItems,
      opmlTitle: input.opmlTitle,
      opmlAuthor: input.opmlAuthor,
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
