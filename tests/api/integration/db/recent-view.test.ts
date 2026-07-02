import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const migrationPath = join(
  import.meta.dir,
  "../../../../packages/db/drizzle/0024_recent_viewed_at.sql",
);
const journalPath = join(import.meta.dir, "../../../../packages/db/drizzle/meta/_journal.json");

describe("recent viewed timestamp migration", () => {
  test("adds view timestamps, backfills read items, and indexes recent lookups", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "last_viewed_at" timestamp`);
    expect(migration).toContain(`WHERE "last_viewed_at" IS NULL AND "read_override" IS TRUE`);
    expect(migration).toContain(`WHERE "last_viewed_at" IS NULL AND "is_read" IS TRUE`);
    expect(migration).toContain(`feed_item_user_state_viewed_idx`);
    expect(migration).toContain(`article_clips_user_viewed_idx`);
  });

  test("migration is registered in the drizzle journal", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(journal.entries).toContainEqual(
      expect.objectContaining({
        idx: 24,
        tag: "0024_recent_viewed_at",
      }),
    );
  });
});
