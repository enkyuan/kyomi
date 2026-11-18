import { describe, expect, test } from "bun:test";
import { parseFeedDocument } from "@kyomi/ingest";
import { normalizeArticleUrl } from "@kyomi/ingest/lib/article-identity";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/reader/sanitization";

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
    expect(item?.contentHtml).toContain('<pre data-kyomi-lang="ts"><code');
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

  test("compiles item HTML against the item link and keeps the raw body", () => {
    const body = `<p data-kyomi-url="javascript:alert(1)">See note<sup><a href="#fn1">1</a></sup>.</p>
      <img src="data:image/gif;base64,R0" data-src="images/chart.png" alt="Chart">
      <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Talk"></iframe>
      <ol><li id="fn1">The note.</li></ol>`;
    const parsed = parseFeedDocument(
      `<?xml version="1.0"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <title>Compiled feed</title>
          <link>https://example.com/</link>
          <description>Updates</description>
          <item>
            <title>Compiled article</title>
            <link>https://example.com/posts/compiled/</link>
            <guid>compiled-1</guid>
            <content:encoded><![CDATA[${body}]]></content:encoded>
          </item>
          <item>
            <title>Markdown article</title>
            <link>https://example.com/posts/markdown/</link>
            <guid>markdown-1</guid>
            <description>## Heading

- one
- two

\`\`\`ts
const x = 1;
\`\`\`</description>
          </item>
        </channel>
      </rss>`,
      "feed-1",
      "https://example.com/feed.xml",
    );

    const html = parsed.items[0];
    expect(html?.contentSanitizerVersion).toBe(ARTICLE_HTML_SANITIZER_VERSION);
    expect(html?.contentRaw).toBe(body);
    expect(html?.contentHtml).toContain(
      'src="https://example.com/posts/compiled/images/chart.png"',
    );
    expect(html?.contentHtml).toContain('<a href="#kyomi-fn1">1</a>');
    expect(html?.contentHtml).toContain('id="kyomi-fn1"');
    expect(html?.contentHtml).toContain('data-kyomi-embed="youtube"');
    expect(html?.contentHtml).not.toContain("javascript:");
    expect(html?.contentHtml).not.toContain("<iframe");

    const markdown = parsed.items[1];
    expect(markdown?.contentSource).toBe("feed_markdown");
    expect(markdown?.contentSanitizerVersion).toBeNull();
    expect(markdown?.contentRaw).toContain("## Heading");
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

  describe("item links", () => {
    const FEED_URL = "https://example.com/feed.xml";
    const rss = (link: string) => `<?xml version="1.0"?>
      <rss version="2.0"><channel><title>T</title><link>https://example.com/</link>
        <item><title>A</title><link>${link}</link><guid>g-1</guid><description>d</description></item>
      </channel></rss>`;
    const atom = (href: string) => `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom"><title>T</title><id>x</id>
        <entry><title>A</title><id>e-1</id><link rel="alternate" href="${href}"/><summary>s</summary></entry>
      </feed>`;
    const jsonFeed = (url: string) =>
      JSON.stringify({
        version: "https://jsonfeed.org/version/1.1",
        title: "T",
        items: [{ id: "1", url, content_text: "x" }],
      });

    const links = (body: string) =>
      parseFeedDocument(body, "feed-1", FEED_URL).items.map((item) => item.link);

    test.each([
      "javascript:alert(document.domain)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:x",
      "file:///etc/passwd",
      "intent://x#Intent;end",
    ])("does not keep a %s link a client would open", (hostile) => {
      for (const body of [
        rss(hostile.replaceAll("<", "&lt;")),
        atom(hostile.replaceAll("<", "&lt;")),
        jsonFeed(hostile),
      ]) {
        const [link] = links(body);
        expect(link).toMatch(/^https:\/\/example\.com\/feed\.xml#(item|entry)-1$/);
      }
    });

    test("keeps absolute and feed-relative http(s) links as the feed wrote them", () => {
      expect(links(rss("https://example.com/posts/a"))).toEqual(["https://example.com/posts/a"]);
      expect(links(rss("http://example.com/posts/a"))).toEqual(["http://example.com/posts/a"]);
      expect(links(rss("/posts/a"))).toEqual(["/posts/a"]);
      expect(links(atom("https://example.com/posts/b"))).toEqual(["https://example.com/posts/b"]);
      expect(links(jsonFeed("https://example.com/posts/c"))).toEqual([
        "https://example.com/posts/c",
      ]);
    });

    test("drops a link that carries a login, as it does for a feed-level URL", () => {
      const hostile = "https://reader:s3cret@example.com/posts/a";
      for (const body of [rss(hostile), atom(hostile), jsonFeed(hostile)]) {
        expect(links(body)[0]).toMatch(/^https:\/\/example\.com\/feed\.xml#(item|entry)-1$/);
      }
    });
  });

  describe("item identity", () => {
    const FEED_URL = "https://example.com/feed.xml";
    const rssItems = (items: string) => `<?xml version="1.0"?>
      <rss version="2.0"><channel><title>T</title><link>https://example.com/</link>${items}</channel></rss>`;
    const parse = (body: string) => parseFeedDocument(body, "feed-1", FEED_URL).items;
    const distinct = (values: string[]) => new Set(values).size;

    test.each([
      [
        "RSS items whose only identity is a urn: or tag: guid",
        rssItems(
          ["urn:uuid:aaaa-1", "urn:uuid:aaaa-2", "tag:example.com,2024:post-3"]
            .map((guid) => `<item><title>t</title><guid isPermaLink="false">${guid}</guid></item>`)
            .join(""),
        ),
      ],
      [
        "RSS items linking to mailto: or javascript:",
        rssItems(
          ["mailto:a1@b.c", "mailto:a2@b.c", "javascript:alert(1)", "javascript:alert(2)"]
            .map((link) => `<item><title>t</title><link>${link}</link></item>`)
            .join(""),
        ),
      ],
      [
        "Atom entries with a magnet: alternate",
        `<feed xmlns="http://www.w3.org/2005/Atom"><title>T</title><id>x</id>${[1, 2, 3]
          .map(
            (n) =>
              `<entry><title>t</title><id>e${n}</id><link rel="alternate" href="magnet:?xt=urn:btih:${n}"/></entry>`,
          )
          .join("")}</feed>`,
      ],
      [
        "JSON Feed items with an app-scheme url",
        JSON.stringify({
          version: "https://jsonfeed.org/version/1.1",
          title: "T",
          items: [1, 2, 3].map((n) => ({ id: String(n), url: `app://x/${n}`, content_text: "x" })),
        }),
      ],
    ])("keeps %s as separate items, and never shows a non-http link", (_, body) => {
      const items = parse(body);

      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(distinct(items.map((item) => item.id))).toBe(items.length);
      expect(distinct(items.map((item) => item.canonicalUrl))).toBe(items.length);
      for (const item of items) {
        expect(item.link).toMatch(/^https:\/\/example\.com\/feed\.xml#(item|entry)-\d+$/);
      }
    });

    test("derives the same ids as before non-http links were replaced", () => {
      const urn = parse(
        rssItems(
          ["urn:uuid:aaaa-1", "urn:uuid:aaaa-2", "tag:example.com,2024:post-3"]
            .map((guid) => `<item><title>t</title><guid isPermaLink="false">${guid}</guid></item>`)
            .join(""),
        ),
      );
      expect(urn.map((item) => item.id)).toEqual([
        "77bac7e9-6b05-524f-a4d2-c7c6bd73b883",
        "b2f41a93-f8f9-54c1-897a-ee79b6f4a93c",
        "ac1172d2-ce5b-519b-9eb2-21070114ff69",
      ]);
      expect(urn[0]?.stableIdentity).toBe("urn:uuid:aaaa-1");
      expect(urn[0]?.canonicalUrl).toBe("urn:uuid:aaaa-1");

      const http = parse(
        rssItems(`
          <item><title>t</title><link>https://example.com/p/1?utm_source=x&amp;id=2#frag</link></item>
          <item><title>t</title><link>/rel/2/</link></item>
          <item><title>t</title><link>HTTPS://EXAMPLE.com/Up/</link><guid>g</guid></item>`),
      );
      expect(http.map((item) => item.id)).toEqual([
        "561a49a9-22ab-51c2-a412-d2301401fba2",
        "bef0d2d2-c571-5566-aaeb-fab2465da141",
        "026091b9-cdf6-5299-bc24-d72b73f83597",
      ]);
    });
  });

  describe("images and icons", () => {
    const FEED_URL = "https://example.com/feed.xml";
    const hostileUrls = [
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "file:///etc/passwd",
      "https://reader:s3cret@cdn.example.com/a.png",
    ];
    const rssWithItemHtml = (html: string, channelExtra = "") => `<?xml version="1.0"?>
      <rss version="2.0"><channel><title>T</title><link>https://example.com/</link>${channelExtra}
        <item><title>A</title><link>https://example.com/posts/a</link><guid>a</guid>
          <description><![CDATA[${html}]]></description></item>
      </channel></rss>`;

    test.each(hostileUrls)("does not keep %s as an item image", (url) => {
      for (const html of [
        `<p>Text</p><img src="${url}">`,
        `<meta property="og:image" content="${url}"><p>Text</p>`,
      ]) {
        const [item] = parseFeedDocument(rssWithItemHtml(html), "feed-1", FEED_URL).items;
        expect(item?.imageUrl).toBeNull();
      }
    });

    test("keeps absolute and relative http(s) item images, resolved against the item link", () => {
      const imageUrl = (html: string) =>
        parseFeedDocument(rssWithItemHtml(html), "feed-1", FEED_URL).items[0]?.imageUrl;

      expect(imageUrl('<img src="https://cdn.example.com/a.png">')).toBe(
        "https://cdn.example.com/a.png",
      );
      expect(imageUrl('<img src="/img/a.png">')).toBe("https://example.com/img/a.png");
      expect(imageUrl('<img src="b.png">')).toBe("https://example.com/posts/b.png");
      expect(imageUrl('<img src="//cdn.example.com/c.png">')).toBe("https://cdn.example.com/c.png");
    });

    test.each(hostileUrls)("does not keep %s as the feed icon", (url) => {
      const iconUrl = (body: string) =>
        parseFeedDocument(body, "feed-1", FEED_URL).metadata.iconUrl;

      expect(iconUrl(rssWithItemHtml("x", `<image><url>${url}</url></image>`))).toBeNull();
      expect(iconUrl(rssWithItemHtml("x", `<image>${url}</image>`))).toBeNull();
      expect(
        iconUrl(
          `<feed xmlns="http://www.w3.org/2005/Atom"><title>T</title><icon>${url}</icon><logo>${url}</logo></feed>`,
        ),
      ).toBeNull();
      expect(
        iconUrl(
          JSON.stringify({
            version: "https://jsonfeed.org/version/1.1",
            title: "T",
            icon: url,
            favicon: url,
            items: [],
          }),
        ),
      ).toBeNull();
    });

    test("keeps http(s) feed icons, resolved against the feed URL", () => {
      const iconUrl = (body: string) =>
        parseFeedDocument(body, "feed-1", FEED_URL).metadata.iconUrl;

      expect(iconUrl(rssWithItemHtml("x", "<image><url>/logo.png</url></image>"))).toBe(
        "https://example.com/logo.png",
      );
      expect(
        iconUrl(
          '<feed xmlns="http://www.w3.org/2005/Atom"><title>T</title><icon>https://cdn.example.com/i.ico</icon></feed>',
        ),
      ).toBe("https://cdn.example.com/i.ico");
      expect(
        iconUrl(
          JSON.stringify({
            version: "https://jsonfeed.org/version/1.1",
            title: "T",
            favicon: "f.ico",
            items: [],
          }),
        ),
      ).toBe("https://example.com/f.ico");
    });

    test("does not keep a feed-level site link that carries a login", () => {
      const link = (body: string) => parseFeedDocument(body, "feed-1", FEED_URL).metadata.link;
      const hostile = "https://reader:s3cret@example.com/";

      expect(
        link(rssWithItemHtml("x").replace("https://example.com/</link>", `${hostile}</link>`)),
      ).toBeNull();
      expect(
        link(
          JSON.stringify({
            version: "https://jsonfeed.org/version/1.1",
            title: "T",
            home_page_url: hostile,
            items: [],
          }),
        ),
      ).toBeNull();
      expect(link(rssWithItemHtml("x"))).toBe("https://example.com/");
    });
  });
});

describe("normalizeArticleUrl", () => {
  test("drops tracking parameters and leaves an untouched query byte-identical", () => {
    expect(normalizeArticleUrl("https://a.com/p?utm_source=x&id=2&fbclid=3")).toBe(
      "https://a.com/p?id=2",
    );
    expect(normalizeArticleUrl("https://a.com/p?UTM_x=1&gclid=2&mc_cid=3")).toBe("https://a.com/p");
    expect(normalizeArticleUrl("https://A.com/p/?q=a%20b&x=%7E")).toBe(
      "https://a.com/p?q=a%20b&x=%7E",
    );
    expect(normalizeArticleUrl("https://a.com/p?a=1&utm_b=2&a=3#frag")).toBe(
      "https://a.com/p?a=1&a=3",
    );
    expect(normalizeArticleUrl("  not a url ")).toBe("not a url");
  });

  test("stays linear in the number of tracking parameters", () => {
    const query = Array.from({ length: 48_000 }, (_, index) => `utm_${index}=1`).join("&");

    const started = performance.now();
    const normalized = normalizeArticleUrl(`https://example.com/p?${query}&keep=1`);
    const elapsed = performance.now() - started;

    expect(normalized).toBe("https://example.com/p?keep=1");
    // About 15 ms; the per-parameter `searchParams.delete` this replaced took seconds.
    expect(elapsed).toBeLessThan(1_000);
  });

  test("a feed item with tens of thousands of tracking parameters parses promptly", () => {
    const query = Array.from({ length: 48_000 }, (_, index) => `utm_${index}=1`).join("&");
    const body = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title><link>https://example.com/</link>
      <item><title>A</title><link>https://example.com/p?${query}</link><guid>g</guid></item></channel></rss>`;

    const started = performance.now();
    const [item] = parseFeedDocument(body, "feed-1", "https://example.com/feed.xml").items;
    const elapsed = performance.now() - started;

    expect(item?.canonicalUrl).toBe("https://example.com/p");
    expect(elapsed).toBeLessThan(1_000);
  });
});
