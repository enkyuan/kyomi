import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Legacy / demo table; kept for migration compatibility. */
export const todos = pgTable("todos", {
  id: serial().primaryKey(),
  title: text().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
