import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  readerMode: text("reader_mode").notNull().default("smart"),
  theme: text("theme"),
  inboxDefaultView: text("inbox_default_view").notNull().default("today"),
  inboxDensity: text("inbox_density").notNull().default("comfortable"),
  articleOpenBehavior: text("article_open_behavior").notNull().default("split"),
  inboxMarkReadBehavior: text("inbox_mark_read_behavior").notNull().default("on-open"),
  inboxTimestampDisplay: text("inbox_timestamp_display").notNull().default("absolute"),
  inboxTimestampHourCycle: text("inbox_timestamp_hour_cycle").notNull().default("12h"),
  inboxFontSizePx: integer("inbox_font_size_px").notNull().default(16),
  inboxShowFavicons: boolean("inbox_show_favicons").notNull().default(true),
  readerFontSizePx: integer("reader_font_size_px").notNull().default(17),
  readerContentWidth: text("reader_content_width").notNull().default("wide"),
  readerOpenLinksInNewTab: boolean("reader_open_links_in_new_tab").notNull().default(true),
  readerShowLinkPreviews: boolean("reader_show_link_previews").notNull().default(true),
  readerShowImages: boolean("reader_show_images").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
