import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const migrationPath = join(
  import.meta.dir,
  "../../../../packages/db/drizzle/0023_inbox_timestamp_display_relative_global.sql",
);

describe("inbox timestamp display default", () => {
  test("migration sets the global default and existing rows to relative", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(`ALTER COLUMN "inbox_timestamp_display" SET DEFAULT 'relative'`);
    expect(migration).toContain(`UPDATE "user_preferences"`);
    expect(migration).toContain(`"inbox_timestamp_display" = 'relative'`);
    expect(migration).toContain(`WHERE "inbox_timestamp_display" = 'absolute'`);
  });
});
