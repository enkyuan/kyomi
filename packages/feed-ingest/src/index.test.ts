import { describe, expect, test } from "bun:test";
import { parseFeedDocument } from "./index";

describe("parseFeedDocument", () => {
  test("parses RSS metadata and items", () => {
    const parsed = parseFeedDocument(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Example Feed</title>
          <description>Latest updates</description>
          <link>https://example.com</link>
          <item>
            <title>Hello world</title>
            <link>https://example.com/posts/hello</link>
            <description><![CDATA[<p>First post</p>]]></description>
            <pubDate>Tue, 08 Apr 2026 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`,
      "feed_1",
      "https://example.com/feed.xml",
    );

    expect(parsed.metadata.title).toBe("Example Feed");
    expect(parsed.metadata.link).toBe("https://example.com");
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.title).toBe("Hello world");
    expect(parsed.items[0]?.link).toBe("https://example.com/posts/hello");
    expect(parsed.items[0]?.summary).toBe("First post");
  });

  test("parses JSON feed metadata and items", () => {
    const parsed = parseFeedDocument(
      JSON.stringify({
        title: "JSON Feed",
        description: "Updates from JSON",
        home_page_url: "https://example.com",
        items: [
          {
            id: "item-1",
            url: "https://example.com/posts/json",
            title: "JSON hello",
            summary: "A JSON feed item",
            content_text: "A JSON feed item",
            date_published: "2026-04-08T10:00:00.000Z",
          },
        ],
      }),
      "feed_1",
      "https://example.com/feed.json",
    );

    expect(parsed.metadata.title).toBe("JSON Feed");
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.title).toBe("JSON hello");
    expect(parsed.items[0]?.summary).toBe("A JSON feed item");
  });
});
