import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseSnapshot, snapshotRequest } from "@kyomi/ingest/enrichment";
import { expectLinear, hostileInputs } from "@api-tests/support/hostile-text";
import { htmlFragmentToText } from "../../../../../../packages/ingest/src/enrichment/snapshot";

const fixture = (name: string) =>
  readFileSync(
    new URL(`../../../../fixtures/articles/enrichment/${name}`, import.meta.url),
    "utf8",
  );
const FETCHED_AT = "2026-10-24T00:00:00.000Z";

describe("snapshotRequest", () => {
  test("builds public endpoints per provider", () => {
    expect(
      snapshotRequest("bluesky", "https://bsky.app/profile/alice.bsky.social/post/3kabc")?.url,
    ).toBe(
      "https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?depth=0&parentHeight=0&uri=at%3A%2F%2Falice.bsky.social%2Fapp.bsky.feed.post%2F3kabc",
    );
    expect(snapshotRequest("mastodon", "https://hachyderm.io/@bob/111")?.url).toBe(
      "https://hachyderm.io/api/v1/statuses/111",
    );
    expect(snapshotRequest("x", "https://twitter.com/carol/status/1")?.url).toStartWith(
      "https://publish.twitter.com/oembed?",
    );
    expect(snapshotRequest("threads", "https://www.threads.net/@d/post/A")?.url).toBe(
      "https://www.threads.net/@d/post/A",
    );
  });

  test("rejects non-post URLs and plain-http Mastodon", () => {
    expect(snapshotRequest("bluesky", "https://bsky.app/profile/alice")).toBeNull();
    expect(snapshotRequest("mastodon", "http://hachyderm.io/@bob/111")).toBeNull();
    expect(snapshotRequest("mastodon", "https://hachyderm.io/about")).toBeNull();
  });
});

describe("parseSnapshot", () => {
  test("bluesky", () => {
    const snapshot = parseSnapshot("bluesky", fixture("bluesky-thread.json"), FETCHED_AT);
    expect(snapshot).toEqual({
      text: [{ type: "text", value: "Shipping the reader today." }],
      author: {
        name: "Alice",
        handle: "@alice.bsky.social",
        url: "https://bsky.app/profile/alice.bsky.social",
        avatar: { src: "https://cdn.bsky.app/img/avatar/plain/did:plc:abc/a@jpeg", alt: "Alice" },
      },
      publishedAt: "2026-10-20T12:30:00.000Z",
      media: [
        {
          src: "https://cdn.bsky.app/img/feed_fullsize/1@jpeg",
          alt: "A screenshot",
          width: 1200,
          height: 800,
        },
      ],
      fetchedAt: FETCHED_AT,
    });
  });

  test("mastodon keeps images only and flattens HTML", () => {
    const snapshot = parseSnapshot("mastodon", fixture("mastodon-status.json"), FETCHED_AT);
    expect(snapshot?.text).toEqual([
      { type: "text", value: "Hello & welcome\nto the fediverse\n\nSecond paragraph" },
    ]);
    expect(snapshot?.author?.handle).toBe("@bob@hachyderm.io");
    expect(snapshot?.media).toEqual([
      { src: "https://files.hachyderm.io/m.jpg", alt: "Cat", width: 640, height: 480 },
    ]);
  });

  test("x oembed", () => {
    const snapshot = parseSnapshot("x", fixture("x-oembed.json"), FETCHED_AT);
    expect(snapshot?.text?.[0]?.value).toBe("Kyomi is out & about pic.twitter.com/x");
    expect(snapshot?.author).toEqual({
      name: "Carol",
      handle: "@carol",
      url: "https://twitter.com/carol",
    });
  });

  test("threads and instagram read Open Graph", () => {
    const threads = parseSnapshot("threads", fixture("threads.html"), FETCHED_AT);
    expect(threads?.text?.[0]?.value).toBe('Threads says "hi"');
    expect(threads?.author).toEqual({ name: "Dana", handle: "@dana" });
    expect(threads?.thumbnail?.src).toBe("https://scontent.cdninstagram.com/t.jpg");
    expect(parseSnapshot("instagram", fixture("instagram.html"), FETCHED_AT)?.author?.name).toBe(
      "Erin",
    );
  });

  test("returns null for malformed or empty responses", () => {
    expect(parseSnapshot("bluesky", "not json", FETCHED_AT)).toBeNull();
    expect(parseSnapshot("mastodon", "{}", FETCHED_AT)).toBeNull();
    expect(parseSnapshot("x", '{"html":"<div></div>","author_name":"A"}', FETCHED_AT)).toBeNull();
    expect(parseSnapshot("threads", "<html></html>", FETCHED_AT)).toBeNull();
  });
});

describe("htmlFragmentToText", () => {
  test("keeps paragraph and line breaks, drops other tags and decodes entities", () => {
    expect(
      htmlFragmentToText(
        "<p>one</p><p class=x>two &amp; <a href=/x>link</a></p><p>three<br/>four</p>",
      ),
    ).toBe("one\n\ntwo & link\n\nthree\nfour");
  });

  for (const [name, input] of Object.entries(hostileInputs)) {
    test(`stays linear on hostile markup: ${name}`, () => {
      expectLinear(() => htmlFragmentToText(input));
      expectLinear(() =>
        parseSnapshot("x", JSON.stringify({ html: input, author_name: "a" }), FETCHED_AT),
      );
      expectLinear(() => parseSnapshot("threads", input, FETCHED_AT));
    });
  }

  test("reads the first paragraph of an X oEmbed and the Open Graph tags of a page", () => {
    const x = parseSnapshot(
      "x",
      JSON.stringify({
        html: `<blockquote><P class="x">First &amp; only</P><p>second</p></blockquote>`,
        author_name: "Carol",
        author_url: "https://twitter.com/carol",
      }),
      FETCHED_AT,
    );
    expect(x?.text).toEqual([{ type: "text", value: "First & only" }]);

    const page = parseSnapshot(
      "threads",
      `<header><meta property="og:title" content="Dee (@dee)"></header><META NAME="og:description" CONTENT="Hello"><metadata property="og:title" content="no">`,
      FETCHED_AT,
    );
    expect(page?.author).toEqual({ name: "Dee", handle: "@dee" });
    expect(page?.text).toEqual([{ type: "text", value: "Hello" }]);
  });
});
