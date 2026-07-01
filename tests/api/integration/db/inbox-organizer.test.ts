import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const migrationPath = join(
  import.meta.dir,
  "../../../../packages/db/drizzle/0026_inbox_organizer.sql",
);
const journalPath = join(import.meta.dir, "../../../../packages/db/drizzle/meta/_journal.json");

describe("inbox organizer migration", () => {
  test("adds saved aging, view events, and feed ranking rollups", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(`ALTER TABLE "feed_item_user_state" ADD COLUMN "saved_at"`);
    expect(migration).toContain(`ALTER TABLE "article_clips" ADD COLUMN "saved_at"`);
    expect(migration).toContain(`CREATE TABLE "article_view_events"`);
    expect(migration).toContain(`CREATE TABLE "feed_user_stats"`);
    expect(migration).toContain(`feed_user_stats_user_rank_idx`);
    expect(migration).toContain(`feed_item_user_state_saved_at_idx`);
    expect(migration).toContain(`article_clips_user_saved_at_idx`);
    expect(migration).toContain(`INSERT INTO "feed_user_stats"`);
  });

  test("migration is registered in the drizzle journal", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(journal.entries).toContainEqual(
      expect.objectContaining({
        idx: 26,
        tag: "0026_inbox_organizer",
      }),
    );
  });
});
