import { desc, eq, inArray, sql } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  feedItems,
  feeds,
  mapCategoryLabelToCanonical,
  toCategorySlug,
} from "../../packages/db/src";
import { db, pool } from "../../apps/api/src/adapters/db/client";
import { assertApiDatabaseReady } from "../../apps/api/src/adapters/db/script-preflight";
import {
  canonicalWinsOnConflictSql,
  classifyFeedCategories,
  classifyFeedItemCategories,
  isMixedFeedHost,
  syncInferredFeedCategories,
  type InferredCategoryLabel,
} from "../../packages/worker/src";

export type BackfillArgs = {
  apply: boolean;
  limit: number;
  itemLimit: number;
  feedId: string | null;
};

export type BackfillStats = {
  apply: boolean;
  feedsScanned: number;
  feedsWithClassifierCategories: number;
  itemsScanned: number;
  itemsWithClassifierCategories: number;
  assignmentsScanned: number;
  assignmentsRewritten: number;
  assignmentsDroppedUnmapped: number;
};

function valueAfter(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function positiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseBackfillArgs(argv: string[]): BackfillArgs {
  return {
    apply: argv.includes("--apply"),
    limit: positiveInt(valueAfter(argv, "--limit"), 500),
    itemLimit: positiveInt(valueAfter(argv, "--item-limit"), 50),
    feedId: valueAfter(argv, "--feed-id"),
  };
}

export function summarizeBackfill(stats: BackfillStats): string {
  const action = stats.apply ? "APPLIED" : "DRY RUN";
  const verb = stats.apply ? "wrote" : "would write";
  const assignmentVerb = stats.apply ? "rewrote" : "would rewrite";
  return (
    `${action}: scanned ${stats.feedsScanned} feeds and ${stats.itemsScanned} items; ${verb} classifier categories for ${stats.feedsWithClassifierCategories} feeds and ${stats.itemsWithClassifierCategories} items. ` +
    `${assignmentVerb} ${stats.assignmentsRewritten} of ${stats.assignmentsScanned} existing assignments to canonical categories and dropped ${stats.assignmentsDroppedUnmapped} unmapped assignments.`
  );
}

function loadFeeds(args: BackfillArgs) {
  const columns = {
    id: feeds.id,
    title: feeds.title,
    description: feeds.description,
    url: feeds.url,
    link: feeds.link,
    sourceKind: feeds.sourceKind,
  };

  if (!args.feedId) {
    return db.select(columns).from(feeds).orderBy(feeds.id).limit(args.limit);
  }

  return db
    .select(columns)
    .from(feeds)
    .where(eq(feeds.id, args.feedId))
    .orderBy(feeds.id)
    .limit(args.limit);
}

function loadRecentItems(feedId: string, limit: number) {
  return db
    .select({
      id: feedItems.id,
      title: feedItems.title,
      summary: feedItems.summary,
      link: feedItems.link,
      canonicalUrl: feedItems.canonicalUrl,
    })
    .from(feedItems)
    .where(eq(feedItems.feedId, feedId))
    .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
    .limit(limit);
}

type AssignmentRewritePlan = {
  scanned: number;
  rewritten: number;
  droppedUnmapped: number;
};

async function resolveCanonicalCategoryId(
  cache: Map<string, string>,
  canonicalLabel: string,
  now: Date,
): Promise<string> {
  const cached = cache.get(canonicalLabel);
  if (cached) {
    return cached;
  }
  const slug = toCategorySlug(canonicalLabel);
  const [upserted] = await db
    .insert(categories)
    .values({
      id: crypto.randomUUID(),
      slug,
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
  const categoryId = upserted!.id;
  cache.set(canonicalLabel, categoryId);
  return categoryId;
}

async function normalizeFeedCategoryAssignments(
  apply: boolean,
  now: Date,
  cache: Map<string, string>,
): Promise<AssignmentRewritePlan> {
  const rows = await db
    .select({
      id: feedCategoryAssignments.id,
      subjectId: feedCategoryAssignments.feedId,
      categoryId: feedCategoryAssignments.categoryId,
      provenance: feedCategoryAssignments.provenance,
      categoryLabel: categories.label,
    })
    .from(feedCategoryAssignments)
    .innerJoin(categories, eq(categories.id, feedCategoryAssignments.categoryId));

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
    const categoryId = await resolveCanonicalCategoryId(cache, canonical, now);
    // Retargeting a row's category id can collide with another assignment already on the
    // canonical category for the same (feed, provenance): the unique index on
    // (feed, category, provenance) would reject a plain UPDATE in that case, so upsert
    // instead and drop the old row.
    await db
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
    await db.delete(feedCategoryAssignments).where(eq(feedCategoryAssignments.id, row.id));
  }
  if (apply && idsToDelete.length > 0) {
    await db.delete(feedCategoryAssignments).where(inArray(feedCategoryAssignments.id, idsToDelete));
  }
  return plan;
}

async function normalizeFeedItemCategoryAssignments(
  apply: boolean,
  now: Date,
  cache: Map<string, string>,
): Promise<AssignmentRewritePlan> {
  const rows = await db
    .select({
      id: feedItemCategoryAssignments.id,
      subjectId: feedItemCategoryAssignments.feedItemId,
      categoryId: feedItemCategoryAssignments.categoryId,
      provenance: feedItemCategoryAssignments.provenance,
      categoryLabel: categories.label,
    })
    .from(feedItemCategoryAssignments)
    .innerJoin(categories, eq(categories.id, feedItemCategoryAssignments.categoryId));

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
    const categoryId = await resolveCanonicalCategoryId(cache, canonical, now);
    await db
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
    await db.delete(feedItemCategoryAssignments).where(eq(feedItemCategoryAssignments.id, row.id));
  }
  if (apply && idsToDelete.length > 0) {
    await db
      .delete(feedItemCategoryAssignments)
      .where(inArray(feedItemCategoryAssignments.id, idsToDelete));
  }
  return plan;
}

async function normalizeExistingAssignments(
  apply: boolean,
  now: Date,
): Promise<{ scanned: number; rewritten: number; droppedUnmapped: number }> {
  const cache = new Map<string, string>();
  const feedPlan = await normalizeFeedCategoryAssignments(apply, now, cache);
  const itemPlan = await normalizeFeedItemCategoryAssignments(apply, now, cache);
  return {
    scanned: feedPlan.scanned + itemPlan.scanned,
    rewritten: feedPlan.rewritten + itemPlan.rewritten,
    droppedUnmapped: feedPlan.droppedUnmapped + itemPlan.droppedUnmapped,
  };
}

export async function runCategoryBackfill(args: BackfillArgs): Promise<BackfillStats> {
  const stats: BackfillStats = {
    apply: args.apply,
    feedsScanned: 0,
    feedsWithClassifierCategories: 0,
    itemsScanned: 0,
    itemsWithClassifierCategories: 0,
    assignmentsScanned: 0,
    assignmentsRewritten: 0,
    assignmentsDroppedUnmapped: 0,
  };
  const now = new Date();

  const assignmentPlan = await normalizeExistingAssignments(args.apply, now);
  stats.assignmentsScanned = assignmentPlan.scanned;
  stats.assignmentsRewritten = assignmentPlan.rewritten;
  stats.assignmentsDroppedUnmapped = assignmentPlan.droppedUnmapped;

  const feedRows = await loadFeeds(args);

  for (const feed of feedRows) {
    stats.feedsScanned += 1;
    const feedCategories = classifyFeedCategories({
      feedTitle: feed.title,
      feedDescription: feed.description,
      feedUrl: feed.url,
      feedSiteUrl: feed.link,
      sourceKind: feed.sourceKind,
    }).categories;
    if (feedCategories.length > 0) {
      stats.feedsWithClassifierCategories += 1;
    }

    const mixedFeed = isMixedFeedHost(feed.url) || isMixedFeedHost(feed.link);
    const items = await loadRecentItems(feed.id, args.itemLimit);
    const inferredItems = items.map((item) => {
      stats.itemsScanned += 1;
      const inferredCategoryLabels: InferredCategoryLabel[] = mixedFeed
        ? classifyFeedItemCategories({
            feedTitle: feed.title,
            feedDescription: feed.description,
            feedUrl: feed.url,
            feedSiteUrl: feed.link,
            sourceKind: feed.sourceKind,
            itemTitle: item.title,
            itemSummary: item.summary,
            itemUrl: item.link || item.canonicalUrl,
          }).categories
        : [];
      if (inferredCategoryLabels.length > 0) {
        stats.itemsWithClassifierCategories += 1;
      }
      return { id: item.id, inferredCategoryLabels };
    });

    if (args.apply) {
      await syncInferredFeedCategories(
        db,
        {
          feedId: feed.id,
          feedCategories,
          items: inferredItems,
        },
        now,
      );
    }
  }

  return stats;
}

if (import.meta.main) {
  const args = parseBackfillArgs(process.argv);
  try {
    await assertApiDatabaseReady({
      commandName: "categories:backfill",
      ensureSchema: true,
    });
    const stats = await runCategoryBackfill(args);
    console.log(summarizeBackfill(stats));
  } finally {
    await pool.end();
  }
}
