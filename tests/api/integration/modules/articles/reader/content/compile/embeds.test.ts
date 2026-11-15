import { describe, expect, test } from "bun:test";
import { runThrough } from "./document-helpers";

const embedsOf = async (html: string) => (await runThrough(html, "embeds")).blocks;
const iframe = (src: string) => `<iframe src="${src}"></iframe>`;

describe("embeds (pass 15)", () => {
  test("builds the YouTube frame from the allowlisted template, ignoring the source iframe URL", async () => {
    const [embed] = await embedsOf(
      iframe("https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&evil=1"),
    );
    expect(embed).toMatchObject({
      type: "embed",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      providerId: "dQw4w9WgXcQ",
      frameUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      aspectRatio: 16 / 9,
    });
  });

  test.each([
    [
      "https://player.vimeo.com/video/76979871",
      "vimeo",
      "https://player.vimeo.com/video/76979871?dnt=1",
    ],
    [
      "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
      "spotify",
      "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
    ],
    [
      "https://codepen.io/ada/embed/preview/abc123",
      "codepen",
      "https://codepen.io/ada/embed/abc123?default-tab=result",
    ],
    ["https://codesandbox.io/embed/xyz789", "codesandbox", "https://codesandbox.io/embed/xyz789"],
    [
      "https://www.loom.com/embed/0123456789abcdef0123456789abcdef",
      "loom",
      "https://www.loom.com/embed/0123456789abcdef0123456789abcdef",
    ],
  ])("frames %s", async (src, provider, frameUrl) => {
    const [embed] = await embedsOf(iframe(src));
    expect(embed).toMatchObject({ type: "embed", provider, frameUrl });
  });

  test("snapshot-only providers carry no frame", async () => {
    const [tweet, post] = await embedsOf(
      `<blockquote class="twitter-tweet"><p>Hi</p><a href="https://twitter.com/ada/status/123">date</a></blockquote>
       <blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:abc/app.bsky.feed.post/3kxyz"><p>Hi</p></blockquote>`,
    );
    expect(tweet).toMatchObject({
      type: "embed",
      provider: "x",
      url: "https://x.com/ada/status/123",
    });
    expect(tweet).not.toHaveProperty("frameUrl");
    expect(post).toMatchObject({
      provider: "bluesky",
      url: "https://bsky.app/profile/did:plc:abc/post/3kxyz",
    });
  });

  test("keeps the caption of an embed figure", async () => {
    const [embed] = await embedsOf(
      `<figure>${iframe("https://www.youtube.com/embed/dQw4w9WgXcQ")}<figcaption>Talk</figcaption></figure>`,
    );
    expect(embed).toMatchObject({ caption: [{ type: "text", value: "Talk" }] });
  });

  test("honours placement on an embed figure", async () => {
    const [embed] = await embedsOf(
      `<figure class="alignwide">${iframe("https://www.youtube.com/embed/dQw4w9WgXcQ")}</figure>`,
    );
    expect(embed).toMatchObject({ placement: "wide" });
  });

  test("unrecognized iframes are dropped, never framed", async () => {
    const blocks = await embedsOf(`<p>Before</p>${iframe("https://evil.example/embed/1")}`);
    expect(blocks.map((block) => block.type)).toEqual(["paragraph"]);
  });

  test("an embed whose URL does not fit its provider becomes a link card", async () => {
    const draft = await runThrough(iframe("https://www.youtube.com/embed/dQw4w9WgXcQ"), "figures");
    const embed = draft.blocks[0]!;
    if (embed.type !== "embed") {
      throw new Error("expected an embed");
    }
    embed.url = "https://example.com/not-youtube";
    const { ARTICLE_DOCUMENT_PASSES } = await import("@kyomi/worker/document");
    await ARTICLE_DOCUMENT_PASSES.find((pass) => pass.name === "embeds")!.run(draft);
    expect(draft.blocks[0]).toEqual({ type: "linkCard", url: "https://example.com/not-youtube" });
  });

  test("turns a Ghost bookmark into a link card", async () => {
    const [card] = await embedsOf(
      `<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://docs.example.org/g"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Guide</div><div class="kg-bookmark-description">About.</div></div></a></figure>`,
    );
    expect(card).toEqual({
      type: "linkCard",
      url: "https://docs.example.org/g",
      title: "Guide",
      description: "About.",
    });
  });
});
