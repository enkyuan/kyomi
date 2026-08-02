import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { feeds, folders } from "./feeds";

export const OPML_IMPORT_STATUSES = [
  "accepted",
  "parsing",
  "dispatching",
  "running",
  "cancelling",
  "completed",
  "failed",
  "cancelled",
] as const;

export type OpmlImportStatus = (typeof OPML_IMPORT_STATUSES)[number];

export const OPML_IMPORT_ITEM_STATUSES = [
  "pending",
  "leased",
  "processing",
  "subscribed",
  "already_subscribed",
  "failed",
  "cancelled",
] as const;

export type OpmlImportItemStatus = (typeof OPML_IMPORT_ITEM_STATUSES)[number];

export const opmlImports = pgTable(
  "opml_imports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    sourceUrl: text("source_url"),
    sourceXml: text("source_xml"),
    sourceByteLength: integer("source_byte_length").notNull(),
    opmlTitle: text("opml_title"),
    opmlAuthor: text("opml_author"),
    status: text("status").notNull().default("accepted"),
    totalItems: integer("total_items").notNull().default(0),
    completedItems: integer("completed_items").notNull().default(0),
    subscribedItems: integer("subscribed_items").notNull().default(0),
    alreadySubscribedItems: integer("already_subscribed_items").notNull().default(0),
    failedItems: integer("failed_items").notNull().default(0),
    cancelledItems: integer("cancelled_items").notNull().default(0),
    prepareWakeupAt: timestamp("prepare_wakeup_at"),
    cancelRequestedAt: timestamp("cancel_requested_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    lastHeartbeatAt: timestamp("last_heartbeat_at"),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("opml_imports_one_active_per_user_uidx")
      .on(table.userId)
      .where(sql.raw("status IN ('accepted','parsing','dispatching','running','cancelling')")),
    index("opml_imports_user_created_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("opml_imports_reconcile_idx").on(table.status, table.updatedAt, table.id),
    index("opml_imports_retention_idx").on(table.completedAt, table.id),
  ],
);

export const opmlImportItems = pgTable(
  "opml_import_items",
  {
    id: text("id").primaryKey(),
    importId: text("import_id")
      .notNull()
      .references(() => opmlImports.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    originalUrl: text("original_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    title: text("title"),
    folderName: text("folder_name").notNull(),
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    feedId: text("feed_id").references(() => feeds.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at").notNull().defaultNow(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    outcomeAt: timestamp("outcome_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("opml_import_items_import_url_uidx").on(table.importId, table.normalizedUrl),
    uniqueIndex("opml_import_items_import_position_uidx").on(table.importId, table.position),
    index("opml_import_items_dispatch_idx").on(
      table.importId,
      table.status,
      table.availableAt,
      table.position,
      table.id,
    ),
    index("opml_import_items_lease_expiry_idx").on(table.status, table.leaseExpiresAt, table.id),
    index("opml_import_items_failure_page_idx").on(
      table.importId,
      table.status,
      table.position,
      table.id,
    ),
  ],
);
