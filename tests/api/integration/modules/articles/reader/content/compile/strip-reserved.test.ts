import { describe, expect, test } from "bun:test";
import { runPass } from "./run-pass";

describe("compiler pass: strip-reserved", () => {
  test("removes data-kyomi-* attributes from every source element", () => {
    const { html } = runPass(
      "strip-reserved",
      `<figure data-kyomi-embed="youtube" data-kyomi-url="https://evil.example/" class="wp"><pre data-KYOMI-lang="ts" data-lang="ts"><code>x</code></pre></figure>`,
    );

    expect(html).toBe('<figure class="wp"><pre data-lang="ts"><code>x</code></pre></figure>');
  });

  test("unwraps kyomi-* elements and keeps their content", () => {
    const { html } = runPass(
      "strip-reserved",
      `<p>Before <kyomi-embed data-kyomi-url="https://evil.example/">forged <b>text</b></kyomi-embed> after</p>`,
    );

    expect(html).toBe("<p>Before forged <b>text</b> after</p>");
  });

  test("leaves unrelated data attributes and ids for later passes", () => {
    const { html } = runPass("strip-reserved", `<p id="intro" data-component="x">Body</p>`);

    expect(html).toBe('<p data-component="x" id="intro">Body</p>');
  });
});
