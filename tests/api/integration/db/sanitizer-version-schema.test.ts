import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { articleClips, articleExtractionCache, feedItems } from "@kyomi/db";

const drizzleDir = join(import.meta.dir, "../../../../packages/db/drizzle");

function migrationContaining(fragment: string): string {
  const filename = readdirSync(drizzleDir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .findLast((entry) => readFileSync(join(drizzleDir, entry), "utf8").includes(fragment));
  if (!filename) {
    throw new Error("No generated migration contains " + fragment);
  }
  return readFileSync(join(drizzleDir, filename), "utf8");
}

describe("sanitizer version schema", () => {
  test("Drizzle declares nullable sanitizer-version columns", () => {
    expect(feedItems.contentSanitizerVersion.name).toBe("content_sanitizer_version");
    expect(feedItems.extractedContentSanitizerVersion.name).toBe(
      "extracted_content_sanitizer_version",
    );
    expect(articleClips.contentSanitizerVersion.name).toBe("content_sanitizer_version");
    expect(articleClips.extractedContentSanitizerVersion.name).toBe(
      "extracted_content_sanitizer_version",
    );
    expect(articleExtractionCache.sanitizerVersion.name).toBe("sanitizer_version");
  });

  test("the sanitizer-version migration adds exactly five nullable text columns with no rewrite/default", () => {
    const migration = migrationContaining(`ADD COLUMN "content_sanitizer_version" text`);

    expect(migration).toContain(`ADD COLUMN "content_sanitizer_version" text`);
    expect(migration).toContain(`ADD COLUMN "extracted_content_sanitizer_version" text`);
    expect(migration).toContain(`ADD COLUMN "sanitizer_version" text`);
    expect(migration).not.toMatch(/DEFAULT/i);
    expect(migration).not.toMatch(/UPDATE\s/i);
    expect(migration).not.toMatch(/DROP TABLE/i);
  });
});
