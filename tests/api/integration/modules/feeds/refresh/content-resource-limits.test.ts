import { describe, expect, test } from "bun:test";
import { parseFeedDocument } from "@kyomi/worker";

// ponytail: capped at 500 (not the plan's 5,000 target) until large-data-read-models Task 5
// (persistFeedItems) lands to bound SQL statement size for a 5K-item feed.
const FEED_MAX_ITEMS = 500;
const FEED_TITLE_MAX_CHARS = 1_024;
const FEED_DESCRIPTION_MAX_CHARS = 8_192;
const ITEM_TITLE_MAX_CHARS = 1_024;
const ITEM_SOURCE_CONTENT_MAX_BYTES = 262_144;

function rssFeed(options: {
  title?: string;
  description?: string;
  itemCount: number;
  itemTitle?: (index: number) => string;
  itemBody?: (index: number) => string;
}): string {
  const items = Array.from({ length: options.itemCount }, (_, index) => {
    const title = options.itemTitle?.(index) ?? `Article ${index}`;
    const body = options.itemBody?.(index) ?? `Body ${index}`;
    return `<item>
      <title>${title}</title>
      <link>https://example.com/article-${index}</link>
      <guid>article-${index}</guid>
      <description>Summary</description>
      <content:encoded><![CDATA[${body}]]></content:encoded>
      <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
    </item>`;
  }).join("");

  return `<?xml version="1.0"?>
    <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <title>${options.title ?? "Feed"}</title>
        <link>https://example.com/</link>
        <description>${options.description ?? "Updates"}</description>
        ${items}
      </channel>
    </rss>`;
}

function atomFeed(options: { itemCount: number; itemBody?: (index: number) => string }): string {
  const entries = Array.from({ length: options.itemCount }, (_, index) => {
    const body = options.itemBody?.(index) ?? `Body ${index}`;
    return `<entry>
      <title>Article ${index}</title>
      <id>article-${index}</id>
      <link href="https://example.com/article-${index}"/>
      <content type="html"><![CDATA[${body}]]></content>
      <published>2026-07-01T00:00:00Z</published>
    </entry>`;
  }).join("");

  return `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Feed</title>
      <subtitle>Updates</subtitle>
      <link href="https://example.com/"/>
      ${entries}
    </feed>`;
}

function jsonFeed(options: { itemCount: number; itemBody?: (index: number) => string }): string {
  const items = Array.from({ length: options.itemCount }, (_, index) => ({
    id: `article-${index}`,
    title: `Article ${index}`,
    url: `https://example.com/article-${index}`,
    content_html: options.itemBody?.(index) ?? `<p>Body ${index}</p>`,
    date_published: "2026-07-01T00:00:00Z",
  }));
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: "Feed",
    description: "Updates",
    home_page_url: "https://example.com/",
    items,
  });
}

describe("parseFeedDocument content-resource limits", () => {
  for (const [format, build] of [
    ["rss", () => rssFeed({ itemCount: FEED_MAX_ITEMS + 1 })],
    ["atom", () => atomFeed({ itemCount: FEED_MAX_ITEMS + 1 })],
    ["json", () => jsonFeed({ itemCount: FEED_MAX_ITEMS + 1 })],
  ] as const) {
    test(`${format}: caps accepted items at ${FEED_MAX_ITEMS} and drops exactly one item`, () => {
      const parsed = parseFeedDocument(build(), "feed-1", "https://example.com/feed.xml");
      expect(parsed.items).toHaveLength(FEED_MAX_ITEMS);
      expect(parsed.contentLimitStats).toMatchObject({
        sourceItemCount: FEED_MAX_ITEMS + 1,
        acceptedItemCount: FEED_MAX_ITEMS,
        droppedItemCount: 1,
      });
    });
  }

  test("rss: caps feed title and description length", () => {
    const parsed = parseFeedDocument(
      rssFeed({
        title: "T".repeat(FEED_TITLE_MAX_CHARS + 50),
        description: "D".repeat(FEED_DESCRIPTION_MAX_CHARS + 50),
        itemCount: 1,
      }),
      "feed-1",
      "https://example.com/feed.xml",
    );
    expect(parsed.metadata.title.length).toBe(FEED_TITLE_MAX_CHARS);
    expect(parsed.metadata.description.length).toBe(FEED_DESCRIPTION_MAX_CHARS);
  });

  test("rss: caps item title length", () => {
    const parsed = parseFeedDocument(
      rssFeed({ itemCount: 1, itemTitle: () => "X".repeat(ITEM_TITLE_MAX_CHARS + 50) }),
      "feed-1",
      "https://example.com/feed.xml",
    );
    expect(parsed.items[0]?.title.length).toBe(ITEM_TITLE_MAX_CHARS);
  });

  test("rss: accepts a body at exactly the per-item byte cap", () => {
    const body = "a".repeat(ITEM_SOURCE_CONTENT_MAX_BYTES);
    const parsed = parseFeedDocument(
      rssFeed({ itemCount: 1, itemBody: () => body }),
      "feed-1",
      "https://example.com/feed.xml",
    );
    expect(parsed.items[0]?.contentStatus).not.toBe("pending");
    expect(parsed.contentLimitStats.droppedContentItemCount).toBe(0);
  });

  test("rss: omits (rather than truncates) a body one byte over the per-item cap", () => {
    const body = "a".repeat(ITEM_SOURCE_CONTENT_MAX_BYTES + 1);
    const parsed = parseFeedDocument(
      rssFeed({ itemCount: 1, itemBody: () => body }),
      "feed-1",
      "https://example.com/feed.xml",
    );
    expect(parsed.items[0]?.content).toBeNull();
    expect(parsed.items[0]?.contentStatus).toBe("pending");
    expect(parsed.items[0]?.title).toBe("Article 0");
    expect(parsed.contentLimitStats.droppedContentItemCount).toBe(1);
  });

  test("rss: measures item body size in UTF-8 bytes, not UTF-16 code units", () => {
    const body = "😀".repeat(Math.floor(ITEM_SOURCE_CONTENT_MAX_BYTES / 4) + 10);
    const byteLength = Buffer.byteLength(body, "utf8");
    expect(byteLength).toBeGreaterThan(ITEM_SOURCE_CONTENT_MAX_BYTES);

    const parsed = parseFeedDocument(
      rssFeed({ itemCount: 1, itemBody: () => body }),
      "feed-1",
      "https://example.com/feed.xml",
    );
    expect(parsed.items[0]?.content).toBeNull();
    expect(parsed.contentLimitStats.droppedContentItemCount).toBe(1);
  });

  test("rss: once the aggregate accepted-content budget is exhausted, later item bodies are omitted while metadata remains", () => {
    const FEED_ACCEPTED_CONTENT_MAX_BYTES = 4 * 1024 * 1024;
    const perItemBytes = 200_000;
    const itemCount = Math.ceil(FEED_ACCEPTED_CONTENT_MAX_BYTES / perItemBytes) + 2;
    const parsed = parseFeedDocument(
      rssFeed({ itemCount, itemBody: () => "a".repeat(perItemBytes) }),
      "feed-1",
      "https://example.com/feed.xml",
    );

    expect(parsed.items).toHaveLength(itemCount);
    const droppedForBudget = parsed.items.filter((item) => item.content === null);
    expect(droppedForBudget.length).toBeGreaterThan(0);
    for (const item of droppedForBudget) {
      expect(item.title).toBeTruthy();
      expect(item.link).toBeTruthy();
    }
    expect(parsed.contentLimitStats.acceptedContentBytes).toBeLessThanOrEqual(
      FEED_ACCEPTED_CONTENT_MAX_BYTES,
    );
  });

  test("rss: existing 280-character summary behavior is unchanged", () => {
    const longBody = "s".repeat(500);
    const parsed = parseFeedDocument(
      rssFeed({ itemCount: 1, itemBody: () => longBody }),
      "feed-1",
      "https://example.com/feed.xml",
    );
    expect(parsed.items[0]?.summary?.length).toBeLessThanOrEqual(280);
  });

  test("rss: existing XML entity limits still throw the existing normalized error", () => {
    const quotedTitle = Array.from({ length: 200_000 }, () => "&quot;").join("");
    expect(() =>
      parseFeedDocument(
        `<?xml version="1.0"?><rss version="2.0"><channel><title>${quotedTitle}</title><link>https://example.com/</link><description>Updates</description></channel></rss>`,
        "feed-1",
        "https://example.com/feed.xml",
      ),
    ).toThrow();
  });
});
