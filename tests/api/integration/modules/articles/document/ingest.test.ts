import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { articleClips, articleExtractionCache, feedItems } from "@kyomi/db";
import { parseFeedDocument } from "@kyomi/worker";
import { setStoredDocumentCompiler } from "@kyomi/worker/lib/stored-document";
import { attachItemDocuments } from "@kyomi/worker/ingestion";
import { compileBodyDocumentColumns } from "@modules/articles/document/stored";
import { fakeCompiler, TEST_COMPILER_VERSION } from "./helpers";

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title><link>https://example.com/</link><description>d</description>
<item><title>One</title><link>https://example.com/one</link><guid>1</guid>
<description><![CDATA[<p>Hello <b>world</b></p>]]></description><pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate></item></channel></rss>`;

afterEach(() => setStoredDocumentCompiler(null));

describe("document migration", () => {
  test("adds nullable document columns to feed items, clips, and the extraction cache", () => {
    const dir = join(import.meta.dir, "../../../../../../packages/db/drizzle");
    const file = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .reverse()
      .find((f) => readFileSync(join(dir, f), "utf8").includes('"content_document"'));
    expect(file).toBeDefined();
    const sql = readFileSync(join(dir, file!), "utf8");
    for (const column of [
      `"feed_items" ADD COLUMN "content_document" jsonb`,
      `"feed_items" ADD COLUMN "extracted_content_document_version" integer`,
      `"article_clips" ADD COLUMN "content_compiler_version" text`,
      `"article_extraction_cache" ADD COLUMN "document" jsonb`,
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).not.toMatch(/DEFAULT|NOT NULL/i);
    expect(feedItems.contentDocument.name).toBe("content_document");
    expect(articleClips.extractedContentCompilerVersion.name).toBe(
      "extracted_content_compiler_version",
    );
    expect(articleExtractionCache.documentVersion.name).toBe("document_version");
  });
});

describe("ingest document write", () => {
  const parseItems = () => parseFeedDocument(RSS, "feed-1", "https://example.com/feed.xml").items;

  test("parsing stays synchronous and leaves the document fields null", () => {
    setStoredDocumentCompiler(fakeCompiler());
    const [item] = parseItems();
    expect(item?.contentHtml).toContain("Hello");
    expect(item?.contentDocument).toBeNull();
  });

  test("attachItemDocuments stores the compiler's document next to the HTML", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const [item] = await attachItemDocuments(parseItems());
    expect(item?.contentHtml).toContain("Hello");
    expect(item?.contentDocument).toMatchObject({ version: 1 });
    expect(item?.contentDocumentVersion).toBe(1);
    expect(item?.contentCompilerVersion).toBe(TEST_COMPILER_VERSION);
  });

  test("compilation is bounded in concurrency", async () => {
    let active = 0;
    let peak = 0;
    setStoredDocumentCompiler({
      version: "x",
      compile: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return null;
      },
    });
    const [item] = parseItems();
    await attachItemDocuments(
      Array.from({ length: 12 }, () => item!),
      3,
    );
    expect(peak).toBeLessThanOrEqual(3);
  });

  test("without a compiler the item keeps its HTML and stores no document", async () => {
    const [item] = await attachItemDocuments(parseItems());
    expect(item?.contentHtml).toContain("Hello");
    expect(item?.contentDocument).toBeNull();
    expect(item?.contentDocumentVersion).toBeNull();
    expect(item?.contentCompilerVersion).toBeNull();
  });

  test("a compiler that rejects never blocks ingest", async () => {
    setStoredDocumentCompiler({
      version: "x",
      compile: async () => {
        throw new Error("boom");
      },
    });
    const [item] = await attachItemDocuments(parseItems());
    expect(item?.contentHtml).toContain("Hello");
    expect(item?.contentDocument).toBeNull();
  });

  test("clip and replacement writes compile by content source and clear for unsupported ones", async () => {
    setStoredDocumentCompiler(fakeCompiler());
    const html = await compileBodyDocumentColumns({
      raw: "<p>x</p>",
      contentSource: "feed_html",
      baseUrl: "https://example.com/",
      title: "T",
    });
    expect(html.contentCompilerVersion).toBe(TEST_COMPILER_VERSION);
    const linkOnly = await compileBodyDocumentColumns({
      raw: "x",
      contentSource: "link_only",
      baseUrl: null,
      title: null,
    });
    expect(linkOnly).toEqual({
      contentDocument: null,
      contentDocumentVersion: null,
      contentCompilerVersion: null,
    });
  });
});
