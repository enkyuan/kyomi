import type { opmlImports } from "@kyomi/db";
import type { OpmlImportCounters, OpmlImportStatus } from "../types";

type OpmlImportRow = typeof opmlImports.$inferSelect;

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
