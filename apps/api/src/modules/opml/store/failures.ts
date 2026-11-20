import { Effect } from "effect";
import { and, eq, gt, or } from "drizzle-orm";
import { opmlImportItems, opmlImports } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { BadRequest } from "@shared/effect/errors";
import { decodeOpmlFailureCursor, encodeOpmlFailureCursor } from "../cursor/failure";

const OPML_FAILURE_PAGE_DEFAULT_LIMIT = 50;
const OPML_FAILURE_PAGE_MAX_LIMIT = 100;

export type OpmlFailureItem = {
  id: string;
  url: string;
  code: string;
  message: string;
  position: number;
};

export type ListOpmlImportFailuresInput = {
  userId: string;
  importId: string;
  limit?: number;
  cursor?: string;
};

export type OpmlFailurePage = {
  items: OpmlFailureItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

function normalizeOpmlFailureLimit(limit: number | undefined): number {
  return Math.min(
    Math.max(1, limit ?? OPML_FAILURE_PAGE_DEFAULT_LIMIT),
    OPML_FAILURE_PAGE_MAX_LIMIT,
  );
}

/**
 * Keyset-paginates failed items for one user-owned import, ordered ascending by
 * (position, id) using the opml_import_items_failure_page_idx index. An invalid cursor fails
 * with `BadRequest` OPML_FAILURE_CURSOR_INVALID rather than silently restarting from the start.
 */
export const listOpmlImportFailures = Effect.fn("opml.store.list_failures")(function* (
  input: ListOpmlImportFailuresInput,
) {
  const db = yield* Db;
  const limit = normalizeOpmlFailureLimit(input.limit);
  const cursor = input.cursor === undefined ? null : decodeOpmlFailureCursor(input.cursor);
  if (input.cursor !== undefined && !cursor) {
    return yield* new BadRequest({
      message: "Invalid failure cursor",
      code: "OPML_FAILURE_CURSOR_INVALID",
    });
  }

  const ownerRow = yield* db.use("opml.import.get_owner_row", (client) =>
    client
      .select({ id: opmlImports.id })
      .from(opmlImports)
      .where(and(eq(opmlImports.id, input.importId), eq(opmlImports.userId, input.userId)))
      .limit(1),
  );
  if (ownerRow.length === 0) {
    return { items: [], nextCursor: null, hasMore: false } satisfies OpmlFailurePage;
  }

  const boundary = cursor
    ? or(
        gt(opmlImportItems.position, cursor.position),
        and(eq(opmlImportItems.position, cursor.position), gt(opmlImportItems.id, cursor.id)),
      )
    : undefined;

  const rows = yield* db.use("opml.item.list_failures", (client) =>
    client
      .select({
        id: opmlImportItems.id,
        url: opmlImportItems.normalizedUrl,
        code: opmlImportItems.errorCode,
        message: opmlImportItems.errorMessage,
        position: opmlImportItems.position,
      })
      .from(opmlImportItems)
      .where(
        and(
          eq(opmlImportItems.importId, input.importId),
          eq(opmlImportItems.status, "failed"),
          boundary,
        ),
      )
      .orderBy(opmlImportItems.position, opmlImportItems.id)
      .limit(limit + 1),
  );

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      url: row.url,
      code: row.code ?? "",
      message: row.message ?? "",
      position: row.position,
    })),
    nextCursor:
      hasMore && last ? encodeOpmlFailureCursor({ position: last.position, id: last.id }) : null,
    hasMore,
  } satisfies OpmlFailurePage;
});
