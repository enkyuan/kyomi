// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { RenderHtml } from "@kyomi/reader/web";

/**
 * The language hint is publisher-written (`data-kyomi-lang`, `language-*`). A hint that names a
 * member of `Object.prototype` must be an unknown language, not an exception: the enhancement
 * runs once for the whole article, so one thrown error skips every later code block.
 */
describe("code blocks with a language hint that names an Object.prototype member", () => {
  test.each(["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__"])(
    "%s does not stop the blocks after it from being enhanced",
    async (hint) => {
      const { container } = render(
        <RenderHtml
          html={`<pre data-kyomi-lang="${hint}"><code>first block</code></pre>
            <pre data-kyomi-lang="ts"><code>const port: number = 3000;</code></pre>`}
          baseUrl="https://example.com/p"
        />,
      );

      await waitFor(() => {
        const chromes = container.querySelectorAll(".reader-code-chrome");
        expect(chromes).toHaveLength(2);
        expect(chromes[1]?.querySelector(".reader-code-lang-label")?.textContent).toBe(
          "TypeScript",
        );
      });
      const label = container.querySelector(".reader-code-lang-label")?.textContent ?? "";
      expect(label.toLowerCase()).toContain(hint.toLowerCase().replaceAll("_", ""));
    },
  );

  test("a language class on the code element is treated the same way", async () => {
    const { container } = render(
      <RenderHtml
        html={`<pre><code class="language-constructor">one</code></pre><pre><code class="language-js">two</code></pre>`}
        baseUrl="https://example.com/p"
      />,
    );
    await waitFor(() => {
      expect(container.querySelectorAll(".reader-code-chrome")).toHaveLength(2);
    });
  });

  test("aliases still resolve for highlighting", async () => {
    const { container } = render(
      <RenderHtml
        html={`<pre data-kyomi-lang="yml"><code>a: 1\nb: 2</code></pre>`}
        baseUrl="https://example.com/p"
      />,
    );
    await waitFor(() => {
      expect(container.querySelector("code.hljs.language-yml")).toBeTruthy();
      expect(container.querySelector(".reader-code-lang-label")?.textContent).toBe("YAML");
    });
  });
});
