import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { opmlImportItems, opmlImports } from "@kyomi/db";

const root = join(import.meta.dir, "../../../..");

function generatedMigrationContaining(fragment: string): string {
  const migrationDir = join(root, "packages/db/drizzle");
  const filename = readdirSync(migrationDir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .findLast((entry) => readFileSync(join(migrationDir, entry), "utf8").includes(fragment));
  if (!filename) {
    throw new Error("No generated migration contains " + fragment);
  }
  return readFileSync(join(migrationDir, filename), "utf8");
}

describe("durable OPML import schema", () => {
  test("exports both durable tables", () => {
    expect(opmlImports.id.name).toBe("id");
    expect(opmlImportItems.importId.name).toBe("import_id");
  });

  test("migration creates durable tables and scale indexes", () => {
    const migration = generatedMigrationContaining('CREATE TABLE "opml_imports"');
    expect(migration).toContain('CREATE TABLE "opml_import_items"');
    expect(migration).toContain("opml_imports_one_active_per_user_uidx");
    expect(migration).toContain("opml_import_items_import_url_uidx");
    expect(migration).toContain("opml_import_items_dispatch_idx");
    expect(migration).toContain("opml_import_items_lease_expiry_idx");
  });
});
