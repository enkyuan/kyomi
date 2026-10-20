import { describe, expect, test } from "bun:test";
import { runPass } from "./run-pass";

describe("compiler pass: sanitize", () => {
  test("applies the article policy and its value rules", () => {
    const { html } = runPass(
      "sanitize",
      `<p onclick="x()" class="lead promo" style="color:red"><b>bold</b><a href="javascript:alert(1)">x</a></p><video src="https://m.example/v.mp4" autoplay></video>`,
    );

    expect(html).toBe(
      '<p class="lead"><b>bold</b><a>x</a></p><video controls="" preload="none" src="https://m.example/v.mp4"></video>',
    );
  });

  test("keeps compiler hints and anchors produced by earlier passes", () => {
    const { html } = runPass(
      "sanitize",
      `<pre data-kyomi-lang="ts"><code>a</code></pre><figure data-kyomi-embed="youtube" data-kyomi-url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">v</a></figure><a href="#kyomi-fn-1">1</a><li id="kyomi-fn-1">Note</li>`,
    );

    expect(html).toContain('<pre data-kyomi-lang="ts">');
    expect(html).toContain('data-kyomi-embed="youtube"');
    expect(html).toContain('<a href="#kyomi-fn-1">1</a>');
  });

  test("drops links whose anchor did not survive sanitizing", () => {
    const { html } = runPass(
      "sanitize",
      `<a href="#kyomi-gone">1</a><object id="kyomi-gone"></object><a href="#kyomi-here">2</a><p id="kyomi-here">Here</p>`,
    );

    expect(html).toBe('<a>1</a><a href="#kyomi-here">2</a><p id="kyomi-here">Here</p>');
  });
});
