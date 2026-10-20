// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RenderHtml } from "@kyomi/reader/web";

/** HTML as the ingest compiler stores it: absolute URLs, `kyomi-` anchors, `data-kyomi-*` hints. */
describe("RenderHtml with compiled article HTML", () => {
  test("keeps image dimensions so the browser reserves space before load", () => {
    const { container } = render(
      <RenderHtml
        html='<figure><img src="https://cdn.example/a.png" alt="Chart" width="1600" height="900"><figcaption>Chart</figcaption></figure><p><img src="https://cdn.example/b.png" alt="" width="800" height="400"></p>'
        baseUrl="https://example.com/p"
      />,
    );
    const images = container.querySelectorAll("img");

    expect(images[0]?.getAttribute("width")).toBe("1600");
    expect(images[0]?.getAttribute("height")).toBe("900");
    expect(images[1]?.getAttribute("width")).toBe("800");
  });

  test("treats small declared dimensions as inline images", async () => {
    const { container } = render(
      <RenderHtml
        html='<p>Shipped <img src="https://cdn.example/rocket.png" alt="rocket" width="20" height="20"> today.</p>'
        baseUrl="https://example.com/p"
      />,
    );

    await waitFor(() => {
      expect(container.querySelector("[data-reader-inline-img]")).toBeTruthy();
    });
  });

  test("routes every image request, including srcset candidates and posters, through the transport", () => {
    const transformImageUrl = vi.fn(
      (url: string) => `https://app.kyomi.test/api/reader-image?url=${encodeURIComponent(url)}`,
    );
    const { container } = render(
      <RenderHtml
        html={`<picture><source type="image/webp" srcset="/a.webp 1x, /a@2x.webp 2x"><img src="/a.png" srcset="/a.png 1x, /a@2x.png 2x" alt=""></picture>
          <video src="/clip.mp4" poster="/clip.jpg"></video>`}
        baseUrl="https://publisher.example/posts/1"
        transformImageUrl={transformImageUrl}
      />,
    );
    const proxied = (path: string) =>
      `https://app.kyomi.test/api/reader-image?url=${encodeURIComponent(`https://publisher.example${path}`)}`;

    expect(container.querySelector("source")?.getAttribute("srcset")).toBe(
      `${proxied("/a.webp")} 1x, ${proxied("/a@2x.webp")} 2x`,
    );
    expect(container.querySelector("img")?.getAttribute("srcset")).toBe(
      `${proxied("/a.png")} 1x, ${proxied("/a@2x.png")} 2x`,
    );
    expect(container.querySelector("video")?.getAttribute("poster")).toBe(proxied("/clip.jpg"));
    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "https://publisher.example/clip.mp4",
    );
  });

  test("drops srcset candidates the transport turns into a non-http URL", () => {
    const { container } = render(
      <RenderHtml
        html='<img src="https://cdn.example/a.png" srcset="https://cdn.example/a.png 1x, https://cdn.example/a@2x.png 2x" alt="">'
        baseUrl="https://example.com/p"
        transformImageUrl={(url) => (url.endsWith("@2x.png") ? "data:text/html,x" : url)}
      />,
    );

    expect(container.querySelector("img")?.getAttribute("srcset")).toBe(
      "https://cdn.example/a.png 1x",
    );
  });

  test("keeps compiler anchors as in-page links", () => {
    const { container } = render(
      <RenderHtml
        html='<p>Claim<sup><a href="#kyomi-fn-1">1</a></sup></p><ol><li id="kyomi-fn-1">Note</li></ol>'
        baseUrl="https://example.com/p"
      />,
    );

    expect(container.querySelector("sup a")?.getAttribute("href")).toBe("#kyomi-fn-1");
    expect(container.querySelector("#kyomi-fn-1")?.textContent).toBe("Note");
  });

  test("labels code blocks from the compiler's language and filename hints", async () => {
    const { container } = render(
      <RenderHtml
        html={`<pre data-kyomi-lang="ts" data-kyomi-filename="src/server.ts"><code>const port: number = 3000;</code></pre>
          <pre data-kyomi-lang="Bash"><code class="language-python">echo hi</code></pre>`}
        baseUrl="https://example.com/p"
      />,
    );

    await waitFor(() => {
      const chromes = container.querySelectorAll(".reader-code-chrome");
      expect(chromes).toHaveLength(2);
      const [named, plain] = Array.from(chromes);
      expect(named?.querySelector(".reader-code-lang-label")?.textContent).toBe("src/server.ts");
      expect(named?.querySelector(".reader-code-filename")).toBeTruthy();
      expect(named?.getAttribute("aria-label")).toBe("Code sample (src/server.ts, TypeScript)");
      expect(plain?.querySelector(".reader-code-lang-label")?.textContent).toBe("Bash");
    });
  });
});
