import { describe, expect, test } from "bun:test";
import {
  describeUnsafeFeedUrl,
  planFeedItemRepair,
  planFeedRepair,
  type FeedItemUrls,
  type FeedUrls,
} from "@modules/feeds/repair/urls";

const FEED_URL = "https://feeds.example.com/rss.xml";
const FEED_LINK = "https://example.com/";

const item = (over: Partial<FeedItemUrls> = {}): FeedItemUrls => ({
  link: "https://example.com/posts/1",
  imageUrl: "https://example.com/a.png",
  feedUrl: FEED_URL,
  feedLink: FEED_LINK,
  ...over,
});

const feed = (over: Partial<FeedUrls> = {}): FeedUrls => ({
  url: FEED_URL,
  link: FEED_LINK,
  siteUrl: FEED_LINK,
  canonicalFeedUrl: FEED_URL,
  discoveredFromUrl: FEED_LINK,
  faviconUrl: "https://example.com/favicon.ico",
  ...over,
});

/** Stored values an earlier parser let in: not http(s), or carrying a username or password. */
const HOSTILE = [
  "javascript:alert(document.cookie)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "file:///etc/passwd",
  "ftp://example.com/file",
  "urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a",
  "https://admin:hunter2@evil.example/x",
  "http://admin@evil.example/x",
  "https://:hunter2@evil.example/x",
  "http://exa mple.com/",
];

describe("planFeedItemRepair", () => {
  test.each(HOSTILE)("replaces the link %p with the feed's link", (link) => {
    expect(planFeedItemRepair(item({ link }))).toEqual({
      patch: { link: FEED_LINK },
      linkUnrepairable: false,
    });
  });

  test("falls back to the feed's URL when the feed has no link", () => {
    expect(planFeedItemRepair(item({ link: "javascript:1", feedLink: null })).patch).toEqual({
      link: FEED_URL,
    });
  });

  test("never uses an unacceptable feed link as the replacement", () => {
    for (const feedLink of HOSTILE) {
      expect(planFeedItemRepair(item({ link: "javascript:1", feedLink })).patch).toEqual({
        link: FEED_URL,
      });
    }
  });

  test("leaves the link when the feed offers nothing acceptable to put in its place", () => {
    const plan = planFeedItemRepair(
      item({
        link: "javascript:1",
        feedLink: "https://u:hunter2@example.com/",
        feedUrl: "https://u:hunter2@feeds.example.com/rss.xml",
      }),
    );
    expect(plan).toEqual({ patch: {}, linkUnrepairable: true });
  });

  test("an acceptable absolute or relative link, and an empty one, are left alone", () => {
    for (const link of ["https://example.com/p?id=1#top", "http://example.com/p", "/posts/1", ""]) {
      expect(planFeedItemRepair(item({ link }))).toEqual({ patch: {}, linkUnrepairable: false });
    }
  });

  test.each(HOSTILE)("clears the image %p", (imageUrl) => {
    expect(planFeedItemRepair(item({ imageUrl }))).toEqual({
      patch: { imageUrl: null },
      linkUnrepairable: false,
    });
  });

  test("an acceptable image and a missing one are left alone", () => {
    expect(planFeedItemRepair(item({ imageUrl: "https://cdn.example.com/a.png" })).patch).toEqual(
      {},
    );
    expect(planFeedItemRepair(item({ imageUrl: null })).patch).toEqual({});
  });

  test("repairs link and image of one row together", () => {
    expect(
      planFeedItemRepair(item({ link: "javascript:1", imageUrl: "data:image/png;base64,AA" }))
        .patch,
    ).toEqual({ link: FEED_LINK, imageUrl: null });
  });

  test("the written replacement is itself acceptable, so a second pass changes nothing", () => {
    const first = planFeedItemRepair(item({ link: "https://a:hunter2@evil.example/" }));
    const link = first.patch.link;
    expect(link).toBeDefined();
    expect(planFeedItemRepair(item({ link })).patch).toEqual({});
  });

  test("a relative link on a feed whose own URL carries a login is repaired, not kept", () => {
    const plan = planFeedItemRepair(
      item({
        link: "/posts/1",
        feedUrl: "https://u:hunter2@feeds.example.com/rss.xml",
        feedLink: FEED_LINK,
      }),
    );
    expect(plan.patch).toEqual({ link: FEED_LINK });
  });
});

describe("planFeedRepair", () => {
  test("an acceptable feed has nothing to change and nothing to report", () => {
    expect(planFeedRepair(feed())).toEqual({
      patch: {},
      linksCleared: false,
      faviconCleared: false,
      unsafeUrl: null,
    });
  });

  test("a feed with no optional URLs has nothing to change", () => {
    expect(
      planFeedRepair(
        feed({
          link: null,
          siteUrl: null,
          canonicalFeedUrl: null,
          discoveredFromUrl: null,
          faviconUrl: null,
        }),
      ).patch,
    ).toEqual({});
  });

  test.each(HOSTILE)("clears the favicon %p and how it was resolved", (faviconUrl) => {
    const plan = planFeedRepair(feed({ faviconUrl }));
    expect(plan.patch).toEqual({ faviconUrl: null, faviconSource: null });
    expect(plan.faviconCleared).toBe(true);
    expect(plan.linksCleared).toBe(false);
  });

  test.each(["link", "siteUrl", "canonicalFeedUrl", "discoveredFromUrl"] as const)(
    "clears only %s when it is the unacceptable one",
    (column) => {
      for (const value of HOSTILE) {
        const plan = planFeedRepair(feed({ [column]: value }));
        expect(plan.patch).toEqual({ [column]: null });
        expect(plan.linksCleared).toBe(true);
        expect(plan.faviconCleared).toBe(false);
      }
    },
  );

  test("never rewrites the feed's own url, only reports it", () => {
    const plan = planFeedRepair(feed({ url: "https://user:hunter2@feeds.example.com/rss.xml" }));
    expect(plan.patch).not.toHaveProperty("url");
    expect(plan.unsafeUrl).toEqual({ reason: "credentials", host: "feeds.example.com" });
  });

  test("a credentialed feed url makes its relative sibling values unacceptable", () => {
    const plan = planFeedRepair(
      feed({ url: "https://user:hunter2@feeds.example.com/rss.xml", siteUrl: "/about" }),
    );
    expect(plan.patch).toEqual({ siteUrl: null });
  });
});

describe("describeUnsafeFeedUrl", () => {
  test("an acceptable URL is not reported", () => {
    expect(describeUnsafeFeedUrl("https://feeds.example.com:8443/rss?token=abc")).toBeNull();
  });

  test.each([
    ["https://user:hunter2@feeds.example.com/rss", "feeds.example.com"],
    ["http://user@feeds.example.com:8080/rss?token=s3cr3t#frag", "feeds.example.com:8080"],
    ["https://:hunter2@feeds.example.com/", "feeds.example.com"],
  ])("reports %p by host only", (url, host) => {
    const unsafe = describeUnsafeFeedUrl(url);
    expect(unsafe).toEqual({ reason: "credentials", host });
    const printed = JSON.stringify(unsafe);
    for (const secret of ["user", "hunter2", "s3cr3t", "token", "frag", "rss"]) {
      expect(printed).not.toContain(secret);
    }
  });

  test("a non-http(s) or unparseable URL is reported without any part of it", () => {
    expect(describeUnsafeFeedUrl("ftp://user:hunter2@example.com/x")).toEqual({
      reason: "not_http",
      host: null,
    });
    expect(describeUnsafeFeedUrl("javascript:alert(1)")).toEqual({
      reason: "not_http",
      host: null,
    });
    expect(describeUnsafeFeedUrl("not a url")).toEqual({ reason: "unparseable", host: null });
  });
});
