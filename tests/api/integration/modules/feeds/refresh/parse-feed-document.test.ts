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

  test("resolves relative RSS channel links against the final feed URL", () => {
    const parsed = parseFeedDocument(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Relative site</title>
          <link>/</link>
          <description>Updates</description>
        </channel>
      </rss>`,
      "feed-1",
      "https://www.entrepreneur.com/rss-feed",
    );

    expect(parsed.metadata.link).toBe("https://www.entrepreneur.com/");
  });

  test("extracts RSS channel and item categories", () => {
    const parsed = parseFeedDocument(
      `<?xml version="1.0"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <title>Tech feed</title>
          <link>https://example.com/</link>
          <description>Updates</description>
          <category>Technology</category>
          <itunes:category text="Podcasts">
            <itunes:category text="Software" />
          </itunes:category>
          <item>
            <title>Article one</title>
            <link>https://example.com/article-one</link>
            <guid>article-1</guid>
            <category>JavaScript</category>
            <category domain="https://example.com/taxonomy">Programming</category>
            <description>Summary</description>
            <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Article two</title>
            <link>https://example.com/article-two</link>
            <guid>article-2</guid>
            <description>Summary</description>
            <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`,
      "feed-1",
      "https://example.com/feed.xml",
    );

    expect(parsed.metadata.categoryLabels).toEqual(["Technology", "Podcasts", "Software"]);
    expect(parsed.items[0]?.categoryLabels).toEqual(["JavaScript", "Programming"]);
    expect(parsed.items[1]?.categoryLabels).toEqual([]);
  });

  test("extracts Atom feed and entry categories", () => {
    const parsed = parseFeedDocument(
      `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom feed</title>
        <link href="https://example.com/" rel="alternate" />
        <subtitle>Updates</subtitle>
        <category term="engineering" label="Engineering" />
        <entry>
          <title>Atom article</title>
          <link href="https://example.com/atom-article" rel="alternate" />
          <id>atom-1</id>
          <summary>Summary</summary>
          <updated>2026-07-01T00:00:00Z</updated>
          <category term="ai" label="AI" />
        </entry>
      </feed>`,
      "feed-1",
      "https://example.com/feed.atom",
    );

    expect(parsed.metadata.categoryLabels).toEqual(["Engineering"]);
    expect(parsed.items[0]?.categoryLabels).toEqual(["AI"]);
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

  test("rejects HTML documents instead of treating them as empty feeds", () => {
    expect(() =>
      parseFeedDocument(
        `<!doctype html><html><head><title>Access denied</title></head><body>Blocked</body></html>`,
        "feed-1",
        "https://engineering.fb.com/feed/",
      ),
    ).toThrow("Unsupported feed format: received HTML document");
  });
});
