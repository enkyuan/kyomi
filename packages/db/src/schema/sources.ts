import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { feedItems } from "./articles";
import { feeds } from "./feeds";

/**
 * Normalized platform/source identity. Every followable source (RSS feed, YouTube
 * channel/playlist, public subreddit, public X user) has a `feeds` row; `sources` records the
 * platform identity that produced it. `kind` is one of the roadmap source kinds
 * (`rss`, `youtube`, `reddit`, `x`); `catalog` is never a source kind, only provenance.
 */
export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    externalId: text("external_id"),
    displayName: text("display_name"),
    url: text("url"),
    domain: text("domain"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sources_kind_external_id_unique")
      .on(table.kind, table.externalId)
      // Unqualified column in the predicate: Postgres rejects table-qualified refs in
      // CREATE INDEX ... WHERE, and it matches the other partial-index migrations.
      .where(sql`external_id IS NOT NULL`),
    index("sources_domain_idx").on(table.domain),
  ],
);

/**
 * Non-sensitive platform account / source-connection metadata only. This roadmap never
 * stores Reddit/X access tokens, refresh tokens, or private timeline grants here; that
 * requires a separate reviewed token-vault plan.
 */
export const sourceAccounts = pgTable(
  "source_accounts",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    externalAccountId: text("external_account_id"),
    displayName: text("display_name"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("source_accounts_source_id_idx").on(table.sourceId)],
);

/**
 * Canonical category tree. Slugs are normalized lowercase ASCII; labels preserve
 * capitalization from the best trusted source. `provenance` records who produced the
 * category (`feed`, `catalog`, `connector`, `ai`, `user`).
 */
export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    parentId: text("parent_id"),
    provenance: text("provenance").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    index("categories_parent_id_idx").on(table.parentId),
  ],
);

/** Feed-level category assignment with provenance and optional confidence. */
export const feedCategoryAssignments = pgTable(
  "feed_category_assignments",
  {
    id: text("id").primaryKey(),
    feedId: text("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    provenance: text("provenance").notNull(),
    confidence: doublePrecision("confidence"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("feed_category_assignments_feed_category_provenance_unique").on(
      table.feedId,
      table.categoryId,
      table.provenance,
    ),
    index("feed_category_assignments_category_id_idx").on(table.categoryId),
  ],
);

/**
 * Article-level category assignment, used when a feed item has stronger category metadata
 * than its parent feed.
 */
export const feedItemCategoryAssignments = pgTable(
  "feed_item_category_assignments",
  {
    id: text("id").primaryKey(),
    feedItemId: text("feed_item_id")
      .notNull()
      .references(() => feedItems.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    provenance: text("provenance").notNull(),
    confidence: doublePrecision("confidence"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("feed_item_category_assignments_item_category_provenance_unique").on(
      table.feedItemId,
      table.categoryId,
      table.provenance,
    ),
    index("feed_item_category_assignments_category_id_idx").on(table.categoryId),
  ],
);

/**
 * Article-level tag assignment. Tags carry their own normalized slug/label (they are not a
 * separate dictionary table in this roadmap). AI tags use `provenance = "ai"` with
 * confidence; catalog tags use `provenance = "catalog"`; connector tags use
 * `provenance = "connector"`.
 */
export const feedItemTagAssignments = pgTable(
  "feed_item_tag_assignments",
  {
    id: text("id").primaryKey(),
    feedItemId: text("feed_item_id")
      .notNull()
      .references(() => feedItems.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    provenance: text("provenance").notNull(),
    confidence: doublePrecision("confidence"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("feed_item_tag_assignments_item_slug_provenance_unique").on(
      table.feedItemId,
      table.slug,
      table.provenance,
    ),
    index("feed_item_tag_assignments_slug_idx").on(table.slug),
  ],
);
