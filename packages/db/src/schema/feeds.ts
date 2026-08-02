import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const feeds = pgTable(
  "feeds",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    link: text("link"),
    // Source identity. `sourceKind` is one of rss | youtube | reddit | x; `catalog` is never
    // a source kind. `sourceId` references a normalized `sources` row when present.
    sourceKind: text("source_kind").notNull().default("rss"),
    sourceId: text("source_id"),
    externalId: text("external_id"),
    // URL canonicalization parity: `url` remains the canonical machine-readable fetch URL;
    // these preserve what the user submitted, what to display, and discovery provenance.
    submittedUrl: text("submitted_url"),
    siteUrl: text("site_url"),
    canonicalFeedUrl: text("canonical_feed_url"),
    discoveredFromUrl: text("discovered_from_url"),
    discoveryProvenance: text("discovery_provenance"),
    // Catalog-derived metadata (provenance = catalog).
    catalogSource: text("catalog_source"),
    language: text("language"),
    contentType: text("content_type"),
    qualityScore: doublePrecision("quality_score"),
    lastSuccessfulFetchAt: timestamp("last_successful_fetch_at"),
    catalogUpdatedAt: timestamp("catalog_updated_at"),
    metadataProvenance: text("metadata_provenance"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    // Refresh lifecycle is owned by worker/ingestion and read by UI read models.
    // Reads must never mutate these fields.
    refreshStatus: text("refresh_status").notNull().default("idle"),
    refreshGeneration: integer("refresh_generation").notNull().default(0),
    lastRefreshStartedAt: timestamp("last_refresh_started_at"),
    lastRefreshCompletedAt: timestamp("last_refresh_completed_at"),
    lastRefreshSucceededAt: timestamp("last_refresh_succeeded_at"),
    lastRefreshFailedAt: timestamp("last_refresh_failed_at"),
    lastRefreshError: text("last_refresh_error"),
    etag: text("etag"),
    lastModified: text("last_modified"),
    nextRefreshAt: timestamp("next_refresh_at"),
    /** Best-effort resolved favicon image URL (often same-origin or public icon CDN). */
    faviconUrl: text("favicon_url"),
    /** How `favicon_url` was resolved, e.g. html_link, favicon_ico, feed_icon, google_s2. */
    faviconSource: text("favicon_source"),
    faviconFetchedAt: timestamp("favicon_fetched_at"),
  },
  (table) => [
    uniqueIndex("feeds_url_unique").on(table.url),
    index("feeds_refresh_due_idx")
      .on(table.nextRefreshAt, table.id)
      .where(sql`${table.refreshStatus} NOT IN ('running', 'queued')`),
    index("feeds_refresh_status_idx").on(table.refreshStatus, table.id),
    index("feeds_source_kind_idx").on(table.sourceKind, table.id),
    index("feeds_submitted_url_idx")
      .on(table.submittedUrl)
      .where(sql`${table.submittedUrl} IS NOT NULL`),
    index("feeds_canonical_feed_url_idx")
      .on(table.canonicalFeedUrl)
      .where(sql`${table.canonicalFeedUrl} IS NOT NULL`),
  ],
);

export const faviconHosts = pgTable(
  "favicon_hosts",
  {
    origin: text("origin").primaryKey(),
    hostname: text("hostname").notNull(),
    resolvedUrl: text("resolved_url"),
    source: text("source"),
    status: text("status").notNull().default("miss"),
    contentType: text("content_type"),
    width: integer("width"),
    height: integer("height"),
    expiresAt: timestamp("expires_at"),
    lastCheckedAt: timestamp("last_checked_at"),
    lastFailedAt: timestamp("last_failed_at"),
    errorCode: text("error_code"),
    version: text("version").notNull().default("4"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("favicon_hosts_hostname_idx").on(table.hostname),
    index("favicon_hosts_expires_at_idx").on(table.expiresAt),
  ],
);

export const folders = pgTable(
  "folders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    pinnedAt: timestamp("pinned_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("folders_user_id_name_unique").on(table.userId, table.name),
    index("folders_user_pinned_idx")
      .on(table.userId, table.pinnedAt.desc().nullsFirst(), table.name)
      .where(sql`${table.isPinned} IS TRUE`),
  ],
);

export const feedSubscriptions = pgTable(
  "feed_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feedId: text("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    // Per-user subscription metadata contract: foldering/title/pin/read-cutoff live here.
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    isPinned: boolean("is_pinned").notNull().default(false),
    pinnedAt: timestamp("pinned_at"),
    customTitle: text("custom_title"),
    lastReadCutoff: timestamp("last_read_cutoff"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("feed_subscriptions_user_id_feed_id_unique").on(table.userId, table.feedId),
    index("feed_subscriptions_feed_id_idx").on(table.feedId),
  ],
);

export const feedCategoryBackfillStatus = pgTable(
  "feed_category_backfill_status",
  {
    feedId: text("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    classifierMethod: text("classifier_method").notNull(),
    modelId: text("model_id").notNull(),
    taxonomyVersion: text("taxonomy_version").notNull(),
    status: text("status").notNull(),
    feedClassifierCategories: integer("feed_classifier_categories").notNull().default(0),
    feedClassifierFallbackSuppressed: boolean("feed_classifier_fallback_suppressed")
      .notNull()
      .default(false),
    itemsScanned: integer("items_scanned").notNull().default(0),
    itemsWithClassifierCategories: integer("items_with_classifier_categories").notNull().default(0),
    itemClassifierAbstentions: integer("item_classifier_abstentions").notNull().default(0),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at"),
    failedAt: timestamp("failed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "feed_cat_backfill_status_pk",
      columns: [table.feedId, table.classifierMethod, table.modelId, table.taxonomyVersion],
    }),
    index("feed_cat_backfill_status_idx").on(
      table.classifierMethod,
      table.modelId,
      table.taxonomyVersion,
      table.status,
      table.feedId,
    ),
  ],
);
