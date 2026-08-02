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

    // The 1,200-entity title exceeds the 1,024-char feed/item title budget (Task 2 of
    // content-processing-resource-bounds), so both are clamped rather than rejected.
    expect(parsed.metadata.title).toBe('"'.repeat(1_024));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.title).toBe(`Article ${'"'.repeat(1_024)}`.slice(0, 1_024));
  });

  test("derives distinct item ids for RSS entries that reuse the same GUID", () => {
    const parsed = parseFeedDocument(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Presswire</title>
          <link>https://presswire.com/</link>
          <description>Releases</description>
          <item>
            <title>Article one</title>
            <link>https://presswire.com/release/one</link>
            <guid>reused-guid</guid>
            <description>Summary</description>
            <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Article two</title>
            <link>https://presswire.com/release/two</link>
            <guid>reused-guid</guid>
            <description>Summary</description>
            <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`,
      "feed-1",
      "https://presswire.com/feed?post_type=release",
    );

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]?.stableIdentity).toBe("reused-guid");
    expect(parsed.items[1]?.stableIdentity).toBe("reused-guid");
    expect(parsed.items[0]?.id).not.toBe(parsed.items[1]?.id);
  });

  test("derives the same item id across refreshes for a stable canonical URL", () => {
    const buildFeed = () =>
      parseFeedDocument(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Example</title>
            <link>https://example.com/</link>
            <description>Updates</description>
            <item>
              <title>Article</title>
              <link>https://example.com/article</link>
              <guid isPermaLink="false">${Math.random()}</guid>
              <description>Summary</description>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        "feed-1",
        "https://example.com/feed.xml",
      );

    expect(buildFeed().items[0]?.id).toBe(buildFeed().items[0]?.id);
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

  test("sanitizes feed HTML while preserving readable article structure", () => {
    const parsed = parseFeedDocument(
      `<?xml version="1.0"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <title>Readable feed</title>
          <link>https://example.com/</link>
          <description>Updates</description>
          <item>
            <title>Readable article</title>
            <link>https://example.com/readable</link>
            <guid>article-1</guid>
            <content:encoded><![CDATA[
              <article>
                <h2>Readable heading</h2>
                <p onclick="steal()">Important source paragraph.</p>
                <figure>
                  <img src="https://example.com/chart.png" onerror="steal()" alt="Chart">
                  <figcaption>Chart caption</figcaption>
                </figure>
                <table><thead><tr><th>Metric</th></tr></thead><tbody><tr><td>42</td></tr></tbody></table>
                <pre><code class="language-ts noisy">const answer = 42;</code></pre>
                <a href="javascript:alert(1)">unsafe link</a>
                <script>steal()</script>
                <form><input name="email"></form>
                <iframe src="https://evil.example/embed"></iframe>
              </article>
            ]]></content:encoded>
            <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`,
      "feed-1",
      "https://example.com/feed.xml",
    );

    const item = parsed.items[0];
    expect(item?.contentSource).toBe("feed_html");
    expect(item?.contentHtml).toContain("<h2>Readable heading</h2>");
    expect(item?.contentHtml).toContain("<p>Important source paragraph.</p>");
    expect(item?.contentHtml).toContain("<figure>");
    expect(item?.contentHtml).toContain("<figcaption>Chart caption</figcaption>");
    expect(item?.contentHtml).toContain("<table>");
    expect(item?.contentHtml).toContain("<pre><code");
    expect(item?.contentHtml).toContain("const answer = 42;");
    expect(item?.contentText).toContain("Important source paragraph.");
    expect(item?.contentText).toContain("Metric");
    expect(item?.contentHtml).not.toContain("onclick");
    expect(item?.contentHtml).not.toContain("onerror");
    expect(item?.contentHtml).not.toContain("javascript:");
    expect(item?.contentHtml).not.toContain("<script");
    expect(item?.contentHtml).not.toContain("<form");
    expect(item?.contentHtml).not.toContain("<iframe");
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
    ).toThrow(/Entity expansion.*50001 > 50000/);
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

  test("extracts JSON Feed item tags into categoryLabels", () => {
    const parsed = parseFeedDocument(
      JSON.stringify({
        version: "https://jsonfeed.org/version/1.1",
        title: "JSON feed",
        home_page_url: "https://example.com/",
        items: [
          {
            id: "item-1",
            title: "Article one",
            url: "https://example.com/article-one",
            content_text: "Body",
            tags: ["AI", "Machine Learning"],
          },
        ],
      }),
      "feed-1",
      "https://example.com/feed.json",
    );

    expect(parsed.items[0]?.categoryLabels).toEqual(["AI", "Machine Learning"]);
  });

  test("extracts JSON Feed top-level tags into feed metadata categoryLabels", () => {
    const parsed = parseFeedDocument(
      JSON.stringify({
        version: "https://jsonfeed.org/version/1.1",
        title: "JSON feed",
        home_page_url: "https://example.com/",
        tags: ["Technology", "technology"],
        items: [],
      }),
      "feed-1",
      "https://example.com/feed.json",
    );

    expect(parsed.metadata.categoryLabels).toEqual(["Technology"]);
  });

  test("defaults to no categoryLabels when a JSON Feed has no tags", () => {
    const parsed = parseFeedDocument(
      JSON.stringify({
        version: "https://jsonfeed.org/version/1.1",
        title: "JSON feed",
        home_page_url: "https://example.com/",
        items: [{ id: "item-1", title: "Article one", url: "https://example.com/article-one" }],
      }),
      "feed-1",
      "https://example.com/feed.json",
    );

    expect(parsed.metadata.categoryLabels).toEqual([]);
    expect(parsed.items[0]?.categoryLabels).toEqual([]);
  });
});
