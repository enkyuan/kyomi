import { describe, expect, test } from "bun:test";
import { recognizeEmbedUrl } from "@kyomi/worker/document";
import { runPass } from "./run-pass";

function embedOf(html: string): { provider: string | null; url: string | null } {
  return {
    provider: html.match(/data-kyomi-embed="([^"]+)"/)?.[1] ?? null,
    url: html.match(/data-kyomi-url="([^"]+)"/)?.[1] ?? null,
  };
}

describe("compiler pass: recognize-embeds", () => {
  test.each([
    [
      "https://www.youtube.com/embed/dQw4w9WgXcQ?feature=oembed",
      "youtube",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
    [
      "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?start=30",
      "youtube",
      "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    ],
    ["https://player.vimeo.com/video/76979871?dnt=1", "vimeo", "https://vimeo.com/76979871"],
    [
      "https://open.spotify.com/embed/episode/7makk4oTQel546B0PZlDM5?utm_source=oembed",
      "spotify",
      "https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5",
    ],
    [
      "https://codepen.io/example/embed/abcXYZ?default-tab=result",
      "codepen",
      "https://codepen.io/example/pen/abcXYZ",
    ],
    [
      "https://codesandbox.io/embed/xyz123?fontsize=14",
      "codesandbox",
      "https://codesandbox.io/s/xyz123",
    ],
    [
      "https://www.loom.com/embed/0123456789abcdef0123456789abcdef",
      "loom",
      "https://www.loom.com/share/0123456789abcdef0123456789abcdef",
    ],
    [
      "https://embed.bsky.app/embed/did:plc:abc/app.bsky.feed.post/3kxyz",
      "bluesky",
      "https://bsky.app/profile/did:plc:abc/post/3kxyz",
    ],
    [
      "https://mastodon.social/@example/111111111111111111/embed",
      "mastodon",
      "https://mastodon.social/@example/111111111111111111",
    ],
  ])("maps the iframe %s to %s", (src, provider, url) => {
    const { html } = runPass("recognize-embeds", `<iframe src="${src}" title="Player"></iframe>`);

    expect(embedOf(html)).toEqual({ provider, url });
    expect(html).toContain(`<a href="${url}">Player</a>`);
    expect(html).not.toContain("<iframe");
  });

  test("marks a CMS figure that holds only the embed instead of nesting a new one", () => {
    const { html } = runPass(
      "recognize-embeds",
      `<figure class="wp-block-embed"><div><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div><figcaption>Demo</figcaption></figure>`,
    );

    expect(html).toBe(
      '<figure class="wp-block-embed" data-kyomi-embed="youtube" data-kyomi-url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"><div><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">https://www.youtube.com/watch?v=dQw4w9WgXcQ</a></div><figcaption>Demo</figcaption></figure>',
    );
  });

  test("wraps provider blockquotes and keeps the quoted post text", () => {
    const { html } = runPass(
      "recognize-embeds",
      `<blockquote class="twitter-tweet"><p>It is live.</p>&mdash; Co <a href="https://twitter.com/exampleco/status/184?ref_src=twsrc">Oct 20</a></blockquote>
       <blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/C0abc/?utm_source=ig_embed"></blockquote>
       <blockquote class="tiktok-embed" cite="https://www.tiktok.com/@creator/video/730"></blockquote>
       <blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:abc/app.bsky.feed.post/3kx"></blockquote>`,
    );

    expect(html).toContain(
      '<figure data-kyomi-embed="x" data-kyomi-url="https://x.com/exampleco/status/184"><blockquote class="twitter-tweet"><p>It is live.</p>',
    );
    expect(html).toContain('data-kyomi-url="https://www.instagram.com/p/C0abc/"');
    expect(html).toContain('data-kyomi-url="https://www.tiktok.com/@creator/video/730"');
    expect(html).toContain('data-kyomi-url="https://bsky.app/profile/did:plc:abc/post/3kx"');
  });

  test("recognizes Gist scripts and bare-link paragraphs", () => {
    const { html } = runPass(
      "recognize-embeds",
      `<script src="https://gist.github.com/example/0123abcd.js"></script>
       <p><a href="https://youtu.be/dQw4w9WgXcQ">https://youtu.be/dQw4w9WgXcQ</a></p>
       <p>See <a href="https://youtu.be/dQw4w9WgXcQ">https://youtu.be/dQw4w9WgXcQ</a> later.</p>
       <p><a href="https://youtu.be/dQw4w9WgXcQ">our video</a></p>`,
    );

    expect(html).toContain('data-kyomi-url="https://gist.github.com/example/0123abcd"');
    expect(html.match(/data-kyomi-embed="youtube"/g)).toHaveLength(1);
    expect(html).toContain("<p>See <a");
    expect(html).toContain('<p><a href="https://youtu.be/dQw4w9WgXcQ">our video</a></p>');
  });

  test("leaves unrecognized iframes and lookalike hosts for strip-chrome", () => {
    const { html } = runPass(
      "recognize-embeds",
      `<iframe src="https://ads.example/slot"></iframe><iframe src="https://youtube.com.evil.example/embed/dQw4w9WgXcQ"></iframe><iframe src="https://www.youtube.com/embed/x"></iframe>`,
    );

    expect(html).not.toContain("data-kyomi-embed");
    expect(html.match(/<iframe/g)).toHaveLength(3);
  });

  test("rejects non-http provider URLs", () => {
    expect(recognizeEmbedUrl("javascript://www.youtube.com/embed/dQw4w9WgXcQ")).toBeNull();
    expect(recognizeEmbedUrl("not a url")).toBeNull();
  });
});
