import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const migrationPath = join(
  import.meta.dir,
  "../../../../packages/db/drizzle/0019_feed_refresh_scale_indexes.sql",
);

describe("feed refresh scale indexes", () => {
  test("migration contains scheduler, subscription, inbox, and saved-item indexes", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("feeds_refresh_due_idx");
    expect(migration).toContain("feeds_refresh_status_idx");
    expect(migration).toContain("feed_subscriptions_feed_id_idx");
    expect(migration).toContain("feed_items_published_id_idx");
    expect(migration).toContain("feed_items_feed_published_id_idx");
    expect(migration).toContain("feed_item_user_state_saved_idx");
    expect(migration).toContain("article_clips_user_saved_created_idx");
  });
});
