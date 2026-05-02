import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  readerMode: text("reader_mode").notNull().default("smart"),
  theme: text("theme"),
  inboxDensity: text("inbox_density"),
  articleOpenBehavior: text("article_open_behavior"),
  readerFontSizePx: integer("reader_font_size_px").notNull().default(17),
  readerContentWidth: text("reader_content_width").notNull().default("medium"),
  readerOpenLinksInNewTab: boolean("reader_open_links_in_new_tab").notNull().default(true),
  readerShowImages: boolean("reader_show_images").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
