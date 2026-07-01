import { describe, expect, test } from "bun:test";
import { parseFeedDocument } from "@kyomi/worker";

function repeatEntity(entity: string, count: number): string {
  return Array.from({ length: count }, () => entity).join("");
}

describe("parseFeedDocument", () => {
  test("parses feeds with more than the parser default entity expansion count", () => {
    const quotedTitle = repeatEntity("&quot;", 1_200);
    const parsed = parseFeedDocument(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>${quotedTitle}</title>
          <link>https://example.com/</link>
          <description>Updates</description>
          <item>
            <title>Article ${quotedTitle}</title>
            <link>https://example.com/article</link>
            <guid>article-1</guid>
            <description>Summary</description>
            <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`,
      "feed-1",
      "https://example.com/feed.xml",
    );

    expect(parsed.metadata.title).toBe('"'.repeat(1_200));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.title).toBe(`Article ${'"'.repeat(1_200)}`);
  });

  test("keeps rejecting excessive entity expansion", () => {
    const quotedTitle = repeatEntity("&quot;", 50_001);

    expect(() =>
      parseFeedDocument(
        `<rss><channel><title>${quotedTitle}</title></channel></rss>`,
        "feed-1",
        "https://example.com/feed.xml",
      ),
    ).toThrow("Entity expansion limit exceeded: 50001 > 50000");
  });
});
