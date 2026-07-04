import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const root = join(import.meta.dir, "../../../..");
const sql = readFileSync(join(root, "packages/db/drizzle/0029_source_metadata.sql"), "utf8");

describe("source metadata migration", () => {
  test("creates source identity tables", () => {
    expect(sql).toContain('CREATE TABLE "sources"');
    expect(sql).toContain('CREATE TABLE "source_accounts"');
  });

  test("creates category and assignment tables", () => {
    expect(sql).toContain('CREATE TABLE "categories"');
    expect(sql).toContain('CREATE TABLE "feed_category_assignments"');
    expect(sql).toContain('CREATE TABLE "feed_item_category_assignments"');
    expect(sql).toContain('CREATE TABLE "feed_item_tag_assignments"');
  });

  test("adds source and canonicalization columns to feeds", () => {
    expect(sql).toContain('ALTER TABLE "feeds" ADD COLUMN "source_kind" text DEFAULT \'rss\' NOT NULL');
    expect(sql).toContain('ALTER TABLE "feeds" ADD COLUMN "submitted_url"');
    expect(sql).toContain('ALTER TABLE "feeds" ADD COLUMN "site_url"');
    expect(sql).toContain('ALTER TABLE "feeds" ADD COLUMN "canonical_feed_url"');
    expect(sql).toContain('ALTER TABLE "feeds" ADD COLUMN "language"');
    expect(sql).toContain('ALTER TABLE "feeds" ADD COLUMN "quality_score"');
  });

  test("adds source parity columns to feed_items", () => {
    expect(sql).toContain('ALTER TABLE "feed_items" ADD COLUMN "source_kind" text DEFAULT \'rss\' NOT NULL');
    expect(sql).toContain('ALTER TABLE "feed_items" ADD COLUMN "author_name"');
    expect(sql).toContain('ALTER TABLE "feed_items" ADD COLUMN "language"');
    expect(sql).toContain('ALTER TABLE "feed_items" ADD COLUMN "media"');
  });

  test("enforces per-provenance uniqueness on assignments", () => {
    expect(sql).toContain('"feed_category_assignments_feed_category_provenance_unique"');
    expect(sql).toContain('"feed_item_category_assignments_item_category_provenance_unique"');
    expect(sql).toContain('"feed_item_tag_assignments_item_slug_provenance_unique"');
    expect(sql).toContain('"categories_slug_unique"');
  });

  test("indexes assignment foreign keys and source lookups", () => {
    expect(sql).toContain('CREATE INDEX "feed_category_assignments_category_id_idx"');
    expect(sql).toContain('CREATE INDEX "feed_item_category_assignments_category_id_idx"');
    expect(sql).toContain('CREATE INDEX "feed_item_tag_assignments_slug_idx"');
    expect(sql).toContain('CREATE INDEX "sources_domain_idx"');
    expect(sql).toContain('CREATE INDEX "feeds_source_kind_idx"');
  });

  test("is registered in the drizzle journal", () => {
    const journal = readFileSync(join(root, "packages/db/drizzle/meta/_journal.json"), "utf8");
    expect(journal).toContain('"tag": "0029_source_metadata"');
  });
});
