import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { feeds } from "./feeds";

export const feedItems = pgTable(
  "feed_items",
  {
    id: text("id").primaryKey(),
    feedId: text("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    // Ingestion identity contract: canonical_url is the stable per-feed article identity.
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title").notNull(),
    link: text("link").notNull(),
    summary: text("summary"),
    content: text("content"),
    contentHtml: text("content_html"),
    contentText: text("content_text"),
    contentMarkdown: text("content_markdown"),
    contentStatus: text("content_status"),
    contentSource: text("content_source"),
    extractionErrorCode: text("extraction_error_code"),
    extractionErrorMessage: text("extraction_error_message"),
    /** Source-page full text (Readability); separate from feed-provided content fields. */
    extractedContentHtml: text("extracted_content_html"),
    extractedContentText: text("extracted_content_text"),
    extractedContentStatus: text("extracted_content_status").notNull().default("pending"),
    extractedContentError: text("extracted_content_error"),
    extractedContentUpdatedAt: timestamp("extracted_content_updated_at"),
    imageUrl: text("image_url"),
    // Source parity for non-RSS items. Items still belong to a `feeds` row (feed_id stays
    // NOT NULL); these record the concrete platform identity and normalized author/language.
    sourceKind: text("source_kind").notNull().default("rss"),
    sourceId: text("source_id"),
    externalId: text("external_id"),
    authorName: text("author_name"),
    language: text("language"),
    media: jsonb("media"),
    publishedAt: timestamp("published_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("feed_items_feed_id_canonical_url_unique").on(table.feedId, table.canonicalUrl),
    index("feed_items_published_id_idx").on(
      table.publishedAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index("feed_items_feed_published_id_idx").on(
      table.feedId,
      table.publishedAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
  ],
);

export const feedItemUserState = pgTable(
  "feed_item_user_state",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feedItemId: text("feed_item_id")
      .notNull()
      .references(() => feedItems.id, { onDelete: "cascade" }),
    // Per-user article state contract: read/save state belongs here, not on `feed_items`.
    readOverride: boolean("read_override"),
    isSaved: boolean("is_saved").notNull().default(false),
    savedAt: timestamp("saved_at"),
    lastViewedAt: timestamp("last_viewed_at"),
    hiddenAt: timestamp("hidden_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.feedItemId] }),
    index("feed_item_user_state_viewed_idx")
      .on(
        table.userId,
        table.lastViewedAt.desc().nullsFirst(),
        table.feedItemId.desc().nullsFirst(),
      )
      .where(sql`${table.lastViewedAt} IS NOT NULL`),
    index("feed_item_user_state_saved_idx")
      .on(table.userId, table.isSaved, table.feedItemId)
      .where(sql`${table.isSaved} IS TRUE`),
    index("feed_item_user_state_saved_at_idx")
      .on(table.userId, table.savedAt.asc(), table.feedItemId)
      .where(sql`${table.isSaved} IS TRUE AND ${table.savedAt} IS NOT NULL`),
    index("feed_item_user_state_hidden_idx")
      .on(table.userId, table.hiddenAt, table.feedItemId)
      .where(sql`${table.hiddenAt} IS NOT NULL`),
  ],
);

export const articleClips = pgTable(
  "article_clips",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    contentHtml: text("content_html"),
    contentText: text("content_text"),
    contentMarkdown: text("content_markdown"),
    contentStatus: text("content_status"),
    contentSource: text("content_source"),
    extractionErrorCode: text("extraction_error_code"),
    extractionErrorMessage: text("extraction_error_message"),
    extractedContentHtml: text("extracted_content_html"),
    extractedContentText: text("extracted_content_text"),
    extractedContentStatus: text("extracted_content_status").notNull().default("pending"),
    extractedContentError: text("extracted_content_error"),
    extractedContentUpdatedAt: timestamp("extracted_content_updated_at"),
    note: text("note"),
    isRead: boolean("is_read").notNull().default(false),
    isSaved: boolean("is_saved").notNull().default(true),
    savedAt: timestamp("saved_at"),
    lastViewedAt: timestamp("last_viewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("article_clips_user_viewed_idx")
      .on(table.userId, table.lastViewedAt.desc().nullsFirst(), table.id.desc().nullsFirst())
      .where(sql`${table.lastViewedAt} IS NOT NULL`),
    index("article_clips_user_saved_created_idx")
      .on(
        table.userId,
        table.isSaved,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`${table.isSaved} IS TRUE`),
    index("article_clips_user_saved_at_idx")
      .on(table.userId, table.savedAt.asc(), table.id)
      .where(sql`${table.isSaved} IS TRUE AND ${table.savedAt} IS NOT NULL`),
  ],
);

export const articleViewEvents = pgTable(
  "article_view_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feedItemId: text("feed_item_id").references(() => feedItems.id, { onDelete: "cascade" }),
    clipId: text("clip_id").references(() => articleClips.id, { onDelete: "cascade" }),
    feedId: text("feed_id").references(() => feeds.id, { onDelete: "cascade" }),
    articleType: text("article_type").notNull(),
    isFirstView: boolean("is_first_view").notNull().default(false),
    viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  },
  (table) => [
    index("article_view_events_user_viewed_idx").on(
      table.userId,
      table.viewedAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index("article_view_events_user_feed_viewed_idx")
      .on(table.userId, table.feedId, table.viewedAt.desc().nullsFirst())
      .where(sql`${table.feedId} IS NOT NULL`),
  ],
);

export const feedUserStats = pgTable(
  "feed_user_stats",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feedId: text("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    viewedItemCount: integer("viewed_item_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.feedId] }),
    index("feed_user_stats_user_rank_idx").on(
      table.userId,
      table.viewedItemCount.desc().nullsFirst(),
      table.lastViewedAt.desc().nullsFirst(),
      table.feedId,
    ),
  ],
);

export const articleReports = pgTable(
  "article_reports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    articleId: text("article_id").notNull(),
    articleType: text("article_type").notNull(),
    feedItemId: text("feed_item_id").references(() => feedItems.id, { onDelete: "set null" }),
    clipId: text("clip_id").references(() => articleClips.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    details: text("details"),
    articleTitle: text("article_title").notNull(),
    articleUrl: text("article_url").notNull(),
    feedTitle: text("feed_title"),
    feedUrl: text("feed_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("article_reports_user_created_idx").on(table.userId, table.createdAt.desc().nullsFirst()),
    index("article_reports_article_created_idx").on(
      table.articleId,
      table.createdAt.desc().nullsFirst(),
    ),
  ],
);
