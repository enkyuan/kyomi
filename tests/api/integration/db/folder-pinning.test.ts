import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../../../..");

describe("folder pinning migration", () => {
  test("adds folder pin state and an index for pinned folders", () => {
    const sql = readFileSync(
      join(root, "packages/db/drizzle/0027_folder_pinning.sql"),
      "utf8",
    );

    expect(sql).toContain('ALTER TABLE "folders" ADD COLUMN "is_pinned"');
    expect(sql).toContain('ALTER TABLE "folders" ADD COLUMN "pinned_at"');
    expect(sql).toContain('CREATE INDEX "folders_user_pinned_idx"');
  });

  test("migration is registered in the drizzle journal", () => {
    const journal = readFileSync(join(root, "packages/db/drizzle/meta/_journal.json"), "utf8");

    expect(journal).toContain('"tag": "0027_folder_pinning"');
  });
});
