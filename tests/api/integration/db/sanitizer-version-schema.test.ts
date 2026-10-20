import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { articleClips, articleExtractionCache, feedItems } from "@kyomi/db";

const drizzleDir = join(import.meta.dir, "../../../../packages/db/drizzle");

function migrationFileContaining(fragment: string): string {
  const filename = readdirSync(drizzleDir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .findLast((entry) => readFileSync(join(drizzleDir, entry), "utf8").includes(fragment));
  if (!filename) {
    throw new Error("No generated migration contains " + fragment);
  }
  return filename;
}

function migrationContaining(fragment: string): string {
  return readFileSync(join(drizzleDir, migrationFileContaining(fragment)), "utf8");
}

const RAW_SOURCE_COLUMNS = [
  ["feed_items", "content_raw"],
  ["feed_items", "extracted_content_raw"],
  ["article_clips", "content_raw"],
  ["article_clips", "extracted_content_raw"],
  ["article_extraction_cache", "raw_html"],
] as const;

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

  test("Drizzle declares nullable raw-source columns beside each sanitized body", () => {
    const columns = [
      feedItems.contentRaw,
      feedItems.extractedContentRaw,
      articleClips.contentRaw,
      articleClips.extractedContentRaw,
      articleExtractionCache.rawHtml,
    ];

    expect(columns.map((column) => column.name)).toEqual(
      RAW_SOURCE_COLUMNS.map(([, column]) => column),
    );
    for (const column of columns) {
      expect(column.getSQLType()).toBe("text");
      expect(column.notNull).toBe(false);
      expect(column.hasDefault).toBe(false);
    }
  });

  test("the raw-source migration adds exactly five nullable text columns with no rewrite/default", () => {
    const migration = migrationContaining(`ADD COLUMN "content_raw" text`);

    for (const [table, column] of RAW_SOURCE_COLUMNS) {
      expect(migration).toContain(`ALTER TABLE "${table}" ADD COLUMN "${column}" text;`);
    }
    expect(migration.match(/ADD COLUMN/g)).toHaveLength(RAW_SOURCE_COLUMNS.length);
    expect(migration).not.toMatch(/NOT NULL|DEFAULT|UPDATE\s|DROP\s/i);
  });

  test("a later migration sets lz4 compression on every raw-source column and nothing else", () => {
    const migration = migrationContaining("SET COMPRESSION lz4");
    const statements = migration
      .split("--> statement-breakpoint")
      .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);

    expect(statements).toEqual(
      RAW_SOURCE_COLUMNS.map(
        ([table, column]) => `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET COMPRESSION lz4;`,
      ),
    );
    expect(
      migrationFileContaining("SET COMPRESSION lz4") >
        migrationFileContaining(`ADD COLUMN "content_raw" text`),
    ).toBe(true);
  });
});
