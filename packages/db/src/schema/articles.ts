import { sql } from "drizzle-orm";
import {
  boolean,
  index,
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
    publishedAt: timestamp("published_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("feed_items_feed_id_canonical_url_unique").on(table.feedId, table.canonicalUrl),
    index("feed_items_published_id_idx").on(table.publishedAt.desc(), table.id.desc()),
    index("feed_items_feed_published_id_idx").on(
      table.feedId,
      table.publishedAt.desc(),
      table.id.desc(),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.feedItemId] }),
    index("feed_item_user_state_saved_idx")
      .on(table.userId, table.isSaved, table.feedItemId)
      .where(sql`${table.isSaved} IS TRUE`),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("article_clips_user_saved_created_idx")
      .on(table.userId, table.isSaved, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.isSaved} IS TRUE`),
  ],
);
