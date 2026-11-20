import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const userOnboarding = pgTable("user_onboarding", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  draft: jsonb("draft")
    .$type<{
      name?: string;
      username?: string;
      categories?: string[];
      language?: string;
      bundleIds?: string[];
    }>()
    .notNull()
    .default({}),
  // A draft does not reserve a handle. The unique index arbitrates concurrent completions.
  username: text("username").unique("user_onboarding_username_key"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
