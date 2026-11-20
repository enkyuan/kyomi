import { Effect } from "effect";
import { eq, inArray, sql } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  mapCategoryLabelToCanonical,
  toCategorySlug,
} from "@kyomi/db";
import { canonicalWinsOnConflictSql } from "@kyomi/ingest";
import { Db, type DbShape } from "@adapters/db/service";
import type { DatabaseError } from "@shared/effect/errors";

export type AssignmentRewritePlan = {
  scanned: number;
  rewritten: number;
  droppedUnmapped: number;
};

type AssignmentRow = {
  id: string;
  subjectId: string;
  categoryId: string;
  provenance: string;
  categoryLabel: string;
};

/**
 * The table-specific I/O for one assignment table (feed-level or item-level). The rewrite policy
 * is the same for both, so it lives once in `normalizeAssignments`.
 */
type AssignmentStore = {
  readonly rows: Effect.Effect<AssignmentRow[], DatabaseError>;
  /** Points the row at `categoryId`, then removes the old row. */
  readonly retarget: (
    row: AssignmentRow,
    categoryId: string,
    now: Date,
  ) => Effect.Effect<void, DatabaseError>;
  readonly deleteMany: (ids: readonly string[]) => Effect.Effect<void, DatabaseError>;
};

// Retargeting a row's category id can collide with another assignment already on the canonical
// category for the same (subject, provenance): the unique index on (subject, category,
// provenance) would reject a plain UPDATE, so each store upserts the new row and drops the old.
const feedAssignmentStore = (db: DbShape): AssignmentStore => ({
  rows: db.use("catalog.backfill.feedAssignments", async (client) =>
    client
      .select({
        id: feedCategoryAssignments.id,
        subjectId: feedCategoryAssignments.feedId,
        categoryId: feedCategoryAssignments.categoryId,
        provenance: feedCategoryAssignments.provenance,
        categoryLabel: categories.label,
      })
      .from(feedCategoryAssignments)
      .innerJoin(categories, eq(categories.id, feedCategoryAssignments.categoryId)),
  ),
  retarget: (row, categoryId, now) =>
    db.use("catalog.backfill.retargetFeedAssignment", async (client) => {
      await client
        .insert(feedCategoryAssignments)
        .values({
          id: crypto.randomUUID(),
          feedId: row.subjectId,
          categoryId,
          provenance: row.provenance,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            feedCategoryAssignments.feedId,
            feedCategoryAssignments.categoryId,
            feedCategoryAssignments.provenance,
          ],
          set: { updatedAt: now },
        });
      await client.delete(feedCategoryAssignments).where(eq(feedCategoryAssignments.id, row.id));
    }),
  deleteMany: (ids) =>
    db.use("catalog.backfill.deleteFeedAssignments", async (client) => {
      await client
        .delete(feedCategoryAssignments)
        .where(inArray(feedCategoryAssignments.id, [...ids]));
    }),
});

const itemAssignmentStore = (db: DbShape): AssignmentStore => ({
  rows: db.use("catalog.backfill.itemAssignments", async (client) =>
    client
      .select({
        id: feedItemCategoryAssignments.id,
        subjectId: feedItemCategoryAssignments.feedItemId,
        categoryId: feedItemCategoryAssignments.categoryId,
        provenance: feedItemCategoryAssignments.provenance,
        categoryLabel: categories.label,
      })
      .from(feedItemCategoryAssignments)
      .innerJoin(categories, eq(categories.id, feedItemCategoryAssignments.categoryId)),
  ),
  retarget: (row, categoryId, now) =>
    db.use("catalog.backfill.retargetItemAssignment", async (client) => {
      await client
        .insert(feedItemCategoryAssignments)
        .values({
          id: crypto.randomUUID(),
          feedItemId: row.subjectId,
          categoryId,
          provenance: row.provenance,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            feedItemCategoryAssignments.feedItemId,
            feedItemCategoryAssignments.categoryId,
            feedItemCategoryAssignments.provenance,
          ],
          set: { updatedAt: now },
        });
      await client
        .delete(feedItemCategoryAssignments)
        .where(eq(feedItemCategoryAssignments.id, row.id));
    }),
  deleteMany: (ids) =>
    db.use("catalog.backfill.deleteItemAssignments", async (client) => {
      await client
        .delete(feedItemCategoryAssignments)
        .where(inArray(feedItemCategoryAssignments.id, [...ids]));
    }),
});

/** The category id for a canonical label, upserting the row once and caching the id. */
function resolveCanonicalCategoryId(
  db: DbShape,
  cache: Map<string, string>,
  canonicalLabel: string,
  now: Date,
): Effect.Effect<string, DatabaseError> {
  const cached = cache.get(canonicalLabel);
  if (cached) {
    return Effect.succeed(cached);
  }
  return db
    .use("catalog.backfill.upsertCanonicalCategory", async (client) => {
      const [upserted] = await client
        .insert(categories)
        .values({
          id: crypto.randomUUID(),
          slug: toCategorySlug(canonicalLabel),
          label: canonicalLabel,
          provenance: "feed",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            label: canonicalWinsOnConflictSql(categories.label, sql`excluded.label`),
            provenance: canonicalWinsOnConflictSql(categories.provenance, sql`excluded.provenance`),
            updatedAt: now,
          },
        })
        .returning({ id: categories.id });
      return upserted!.id;
    })
    .pipe(Effect.tap((categoryId) => Effect.sync(() => cache.set(canonicalLabel, categoryId))));
}

const normalizeAssignments = Effect.fn("catalog.backfill.normalizeAssignments")(function* (
  db: DbShape,
  store: AssignmentStore,
  apply: boolean,
  now: Date,
  cache: Map<string, string>,
) {
  const rows = yield* store.rows;
  const plan: AssignmentRewritePlan = { scanned: rows.length, rewritten: 0, droppedUnmapped: 0 };
  const idsToDelete: string[] = [];
  for (const row of rows) {
    const canonical = mapCategoryLabelToCanonical(row.categoryLabel);
    if (!canonical) {
      plan.droppedUnmapped += 1;
      idsToDelete.push(row.id);
      continue;
    }
    if (canonical === row.categoryLabel) {
      continue;
    }
    plan.rewritten += 1;
    if (!apply) {
      continue;
    }
    const categoryId = yield* resolveCanonicalCategoryId(db, cache, canonical, now);
    yield* store.retarget(row, categoryId, now);
  }
  if (apply && idsToDelete.length > 0) {
    yield* store.deleteMany(idsToDelete);
  }
  return plan;
});

/**
 * Rewrites existing feed and item assignments onto canonical categories and drops the ones that
 * map to none. With `apply` false it only counts what it would do.
 */
export const normalizeExistingAssignments = Effect.fn("catalog.backfill.normalizeExisting")(
  function* (apply: boolean, now: Date) {
    const db = yield* Db;
    const cache = new Map<string, string>();
    const feedPlan = yield* normalizeAssignments(db, feedAssignmentStore(db), apply, now, cache);
    const itemPlan = yield* normalizeAssignments(db, itemAssignmentStore(db), apply, now, cache);
    return {
      scanned: feedPlan.scanned + itemPlan.scanned,
      rewritten: feedPlan.rewritten + itemPlan.rewritten,
      droppedUnmapped: feedPlan.droppedUnmapped + itemPlan.droppedUnmapped,
    } satisfies AssignmentRewritePlan;
  },
);
