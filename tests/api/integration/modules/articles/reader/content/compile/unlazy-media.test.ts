import { describe, expect, test } from "bun:test";
import { runPass } from "./run-pass";

describe("compiler pass: unlazy-media", () => {
  test("promotes data-src and data-srcset over a placeholder src", () => {
    const { html } = runPass(
      "unlazy-media",
      `<img src="data:image/gif;base64,R0lGOD" data-src="/a.jpg" data-srcset="/a-800.jpg 800w" alt="A">`,
    );

    expect(html).toContain('src="/a.jpg"');
    expect(html).toContain('srcset="/a-800.jpg 800w"');
  });

  test("keeps a real src even when a lazy attribute is present", () => {
    const { html } = runPass("unlazy-media", `<img src="/real.jpg" data-src="/other.jpg" alt="">`);

    expect(html).toContain('src="/real.jpg"');
  });

  test("replaces a placeholder named in the path, such as grey-placeholder.png", () => {
    const { html } = runPass(
      "unlazy-media",
      `<img src="/img/grey-placeholder.png" data-lazy-src="/img/three.jpg" alt="">`,
    );

    expect(html).toContain('src="/img/three.jpg"');
  });

  test("fills a missing src from the largest picture source, preferring the untyped one", () => {
    const { html } = runPass(
      "unlazy-media",
      `<picture><source type="image/webp" srcset="/a-640.webp 640w, /a-1400.webp 1400w"><source srcset="/a-640.png 640w, /a-1400.png 1400w"><img alt=""></picture>`,
    );

    expect(html).toContain('<img alt="" src="/a-1400.png">');
  });

  test("swaps a noscript fallback in for its placeholder neighbour only", () => {
    const { html } = runPass(
      "unlazy-media",
      `<img src="data:image/gif;base64,R0" data-src="/one.jpg" alt="One"><noscript><img src="/two.jpg" alt="Two"></noscript><img src="/placeholder.svg" alt="Two"><img src="/spacer.gif" alt="Unrelated">`,
    );

    expect(html).toContain('src="/one.jpg"');
    expect(html).toContain('<img alt="Two" src="/two.jpg">');
    expect(html).not.toContain("placeholder.svg");
    expect(html).toContain('<img alt="Unrelated" src="/spacer.gif">');
    expect(html).not.toContain("noscript");
  });

  test("gives a lazy iframe its src so embed recognition can read it", () => {
    const { html } = runPass(
      "unlazy-media",
      `<iframe data-src="https://www.youtube.com/embed/abcdefghijk"></iframe>`,
    );

    expect(html).toContain('src="https://www.youtube.com/embed/abcdefghijk"');
  });
});
