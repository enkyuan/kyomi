// @vitest-environment jsdom
/* oxlint-disable max-lines */

import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { RenderHtml } from "@kyomi/reader/web";

describe("RenderHtml", () => {
  test("keeps div structure and filtered classes aligned with server sanitizer", () => {
    const html = `
      <div class="author-bio media-object">
        <img src="https://example.com/x.png" alt="" />
        <div class="bio-text"><p class="name">Sam</p></div>
      </div>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    expect(root?.querySelector(".author-bio")).toBeTruthy();
    expect(root?.querySelectorAll("div").length).toBeGreaterThanOrEqual(2);
    expect(root?.querySelector("img")?.getAttribute("src")).toBe("https://example.com/x.png");
  });

  test("applies the shared article sanitization policy in the browser reader", () => {
    const html = `
      <article>
        <p onclick="alert(1)">Intro</p>
        <a href="javascript:alert(1)">bad link</a>
        <img src="https://example.com/x.png" alt="" onerror="alert(1)" />
        <pre><code class="language-ts prettyprint promo">const x = 1;</code></pre>
        <div class="author-bio promo sidebar" style="color: red"><span style="color: red">Author</span></div>
      </article>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    expect(root?.querySelector("[onclick]")).toBeNull();
    expect(root?.querySelector("[onerror]")).toBeNull();
    expect(root?.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(root?.querySelector("img")?.getAttribute("loading")).toBe("lazy");
    expect(root?.querySelector("img")?.getAttribute("decoding")).toBe("async");
    expect(root?.querySelector("code")?.className).toBe("language-ts");
    expect(root?.querySelector(".author-bio")).toBeTruthy();
    expect(root?.querySelector(".promo")).toBeNull();
    expect(root?.querySelector(".sidebar")).toBeNull();
    expect(root?.querySelector(".author-bio")?.hasAttribute("style")).toBe(false);
    expect(root?.querySelector("span")?.getAttribute("style")).toBe("color: red");
  });

  test("tags author-bio host as profile thumb and keeps avatar-class image inline", async () => {
    const html = `
      <div class="author-bio"><img src="https://example.com/a.png" alt="" /></div>
      <p><img src="https://example.com/b.png" alt="" class="avatar" /></p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelectorAll("[data-reader-profile-thumb]").length).toBe(1);
      expect(root?.querySelectorAll("[data-reader-inline-img]").length).toBe(1);
    });
  });

  test("does not mark a full-article wrapper (hero + many blocks) as media-aside", async () => {
    const html = `
      <div class="article-wrap">
        <img src="https://example.com/hero.png" alt="" />
        <p>First paragraph.</p>
        <p>Second paragraph.</p>
        <p>Third paragraph.</p>
      </div>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelector(".article-wrap")?.hasAttribute("data-reader-media-aside")).toBe(
        false,
      );
    });
  });

  test("marks author-bio, media-object, and wp-block-media-text for aside layout after enhance", async () => {
    const html = `
      <section class="author-bio">
        <img src="https://example.com/a.png" alt="" />
        <div class="bio-text"><p>Bio</p></div>
      </section>
      <div class="wp-block-media-text">
        <figure class="wp-block-media-text__media"><img src="https://example.com/b.png" alt="" /></figure>
        <div class="wp-block-media-text__content"><p>Aside</p></div>
      </div>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(
        root?.querySelector("section.author-bio")?.getAttribute("data-reader-media-aside"),
      ).toBe("");
      expect(
        root?.querySelector(".wp-block-media-text")?.getAttribute("data-reader-media-aside"),
      ).toBe("");
    });
  });

  test("marks media figures with real figcaptions for tighter caption spacing", async () => {
    const html = `
      <figure>
        <img src="https://example.com/photo.jpg" alt="" />
        <figcaption>
          Lindell Williams and Grant Brodnik align an optical fiber while a second line wraps in the same caption block.
        </figcaption>
      </figure>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelector("figure")?.hasAttribute("data-reader-figure-has-caption")).toBe(
        true,
      );
    });
  });

  test("renders high-confidence implicit TeX variables in HTML prose", async () => {
    const html = `
      <p>
        A brief glossary: θ_c denotes the demand parameters for corridor c,
        and y_{c,t} is the observed demand signal. The later corridor arrives at τ_{c’} > τ_c.
      </p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      expect(root?.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(4);
    });

    const annotations = Array.from(root?.querySelectorAll("annotation") ?? []).map((node) =>
      node.textContent?.trim(),
    );
    expect(annotations).toContain("θ_c");
    expect(annotations).toContain("y_{c,t}");
    expect(annotations).toContain("τ_{c'}");
    expect(annotations).toContain("τ_c");
  });

  test("does not treat ordinary identifiers, urls, or code as implicit TeX", async () => {
    const html = `
      <p>Store feed_item_id next to https://example.com/a_b for diagnostics.</p>
      <pre><code>const x_i = 1;</code></pre>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await act(async () => {
      await Promise.resolve();
    });

    expect(root?.querySelector(".katex")).toBeNull();
    expect(root?.textContent).toContain("feed_item_id");
    expect(root?.textContent).toContain("x_i");
  });

  test("removes Medium image placeholder text and keeps placeholder alt silent", async () => {
    const html = `
      <p>Press enter or click to view image in full size</p>
      <figure>
        <img src="https://example.com/equation.png" alt="Press enter or click to view image in full size" />
        <figcaption>Figure 1. Equation output.</figcaption>
      </figure>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    expect(root?.textContent).not.toContain("Press enter or click to view image in full size");
    expect(root?.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(root?.textContent).toContain("Figure 1. Equation output.");
  });
});

describe("RenderHtml – carousel stripping", () => {
  test("strips lists where every item is a single bullet/dot character", async () => {
    const html = `
      <p>Some real content.</p>
      <ul>
        <li>•</li>
        <li>•</li>
        <li>•</li>
      </ul>
      <p>More real content.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelector("ul")).toBeNull();
      expect(root?.querySelectorAll("p").length).toBeGreaterThanOrEqual(2);
    });
  });

  test("strips <ul> where every item is a bare number (slide index)", async () => {
    const html = `
      <ul>
        <li>1</li>
        <li>2</li>
        <li>3</li>
        <li>4</li>
      </ul>
      <p>Article text.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelector("ul")).toBeNull();
    });
  });

  test("removes empty lists", async () => {
    const html = `
      <ul></ul>
      <p>Article text.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelector("ul")).toBeNull();
    });
  });

  test("preserves legitimate article lists with real text content", async () => {
    const html = `
      <ul>
        <li>First the cats arrived</li>
        <li>Then the dogs followed</li>
        <li>Finally the birds nested</li>
      </ul>
      <p>Article text after a real list.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelector("ul")).toBeTruthy();
      expect(root?.querySelectorAll("li").length).toBe(3);
    });
  });
});

describe("RenderHtml – image-adjacent text classification", () => {
  test("classifies a short paragraph after an image as caption", async () => {
    const html = `
      <img src="https://example.com/photo.jpg" alt="" />
      <p>A bustling market in downtown Tokyo during rush hour.</p>
      <p>The city has seen rapid growth in the last decade, with new transit lines opening every year. Public transportation is the backbone of urban mobility.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      const paragraphs = root?.querySelectorAll("p");
      expect(paragraphs?.length).toBeGreaterThanOrEqual(2);
      // First short paragraph should be classified as caption
      const captionEl = root?.querySelector("[data-reader-figure-caption]");
      expect(captionEl).toBeTruthy();
      expect(captionEl?.textContent).toContain("bustling market");
      // Longer body paragraph should NOT be classified
      const bodyParagraph = Array.from(paragraphs ?? []).find((p) =>
        p.textContent?.includes("rapid growth"),
      );
      expect(bodyParagraph?.hasAttribute("data-reader-figure-caption")).toBe(false);
      expect(bodyParagraph?.hasAttribute("data-reader-figure-credit")).toBe(false);
    });
  });

  test("classifies credit line after an image", async () => {
    const html = `
      <img src="https://example.com/photo.jpg" alt="" />
      <p>Photo by Jane Smith / Reuters</p>
      <p>The economy continued to grow steadily throughout the quarter.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      const creditEl = root?.querySelector("[data-reader-figure-credit]");
      expect(creditEl).toBeTruthy();
      expect(creditEl?.textContent).toContain("Photo by Jane Smith");
      // Body text should NOT be classified
      const bodyP = Array.from(root?.querySelectorAll("p") ?? []).find((p) =>
        p.textContent?.includes("economy"),
      );
      expect(bodyP?.hasAttribute("data-reader-figure-credit")).toBe(false);
    });
  });

  test("does not classify long body paragraphs as caption", async () => {
    const html = `
      <img src="https://example.com/photo.jpg" alt="" />
      <p>The president spoke at length about the importance of investing in infrastructure, renewable energy, and public education to build a stronger foundation for future generations of Americans.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelector("[data-reader-figure-caption]")).toBeNull();
      expect(root?.querySelector("[data-reader-figure-credit]")).toBeNull();
    });
  });

  test("skips classification inside figure elements", async () => {
    const html = `
      <figure>
        <img src="https://example.com/photo.jpg" alt="" />
        <figcaption>A real figcaption</figcaption>
      </figure>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      // figcaption should be present and NOT wrapped with data-reader-figure-caption
      expect(root?.querySelector("figcaption")).toBeTruthy();
      expect(root?.querySelector("[data-reader-figure-caption]")).toBeNull();
    });
  });
});

describe("RenderHtml – fidelity media cleanup", () => {
  test("drops redundant placeholder images in fidelity mode", async () => {
    const html = `
      <p>
        <img src="https://example.com/grey-placeholder.png" alt="" width="300" height="180" />
        <img src="https://example.com/photo.jpg" alt="Article photo" width="1200" height="800" />
      </p>
    `;
    const { container } = render(
      <RenderHtml html={html} baseUrl="https://example.com/p" layoutMode="fidelity" />,
    );
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      const images = root?.querySelectorAll("img");
      expect(images?.length).toBe(1);
      expect(images?.[0]?.getAttribute("src")).toContain("photo.jpg");
    });
  });

  test("classifies adjacent credit text in fidelity mode", async () => {
    const html = `
      <img src="https://example.com/photo.jpg" alt="" />
      <p>Northern Territory Police</p>
      <p>A picture of Kumanjayi Little Baby, used with the permission of her family</p>
      <p>Body text starts here and should remain regular article copy.</p>
    `;
    const { container } = render(
      <RenderHtml html={html} baseUrl="https://example.com/p" layoutMode="fidelity" />,
    );
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      const credit = root?.querySelector("[data-reader-figure-credit]");
      const caption = root?.querySelector("[data-reader-figure-caption]");
      expect(credit?.textContent).toContain("Northern Territory Police");
      expect(caption?.textContent).toContain("used with the permission");
    });
  });
});

describe("RenderHtml – author bio text detection", () => {
  test("detects author bio from adjacent text content", async () => {
    const html = `
      <p><img src="https://example.com/headshot.jpg" alt="" /></p>
      <p>Jane Doe is a reporter covering technology and innovation.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelector("[data-reader-profile-thumb]")).toBeTruthy();
    });
  });

  test("detects broader author host selectors (contributor, bio-wrapper)", async () => {
    const html = `
      <div class="contributor">
        <img src="https://example.com/author.jpg" alt="" />
        <div><p>John Smith, Senior Editor</p></div>
      </div>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      // The contributor wrapper should be marked as media-aside (flex layout)
      expect(root?.querySelector(".contributor")?.hasAttribute("data-reader-media-aside")).toBe(
        true,
      );
    });
  });
});

describe("RenderHtml – gallery markup with class-based indicators", () => {
  test("strips carousel class name from lists via sanitization", async () => {
    const html = `
      <p>Article content before gallery.</p>
      <ul class="carousel-dots">
        <li>slide 1</li>
        <li>slide 2</li>
        <li>slide 3</li>
      </ul>
      <p>Content after gallery.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      // The carousel class is stripped by shared article sanitization.
      // Items with real text survive (correct conservative behavior).
      const lists = root?.querySelectorAll("ul");
      if (lists && lists.length > 0) {
        for (const ul of lists) {
          expect(ul.className).not.toMatch(/carousel/i);
        }
      }
    });
  });

  test("strips carousel dot lists with only bullet characters", async () => {
    const html = `
      <p>Content.</p>
      <ul class="slider-dots">
        <li>•</li>
        <li>•</li>
        <li>•</li>
      </ul>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      // The dot-only items cause full removal by the structural heuristic
      expect(root?.querySelector("ul")).toBeNull();
    });
  });
});

describe("RenderHtml – edge cases", () => {
  test("preserves mixed list with real text even if one item looks numeric", async () => {
    const html = `
      <ol>
        <li>1. Install the package</li>
        <li>2. Configure your environment</li>
        <li>3. Run the application</li>
      </ol>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      // This is a real list — each item has more than just a number
      expect(root?.querySelector("ol")).toBeTruthy();
    });
  });

  test("handles nested wrappers with misleading class names without false positives", async () => {
    const html = `
      <div class="content-wrapper">
        <div class="media-container">
          <img src="https://example.com/hero.jpg" alt="" />
        </div>
        <div class="text-content">
          <p>First paragraph of a long article.</p>
          <p>Second paragraph with more detail.</p>
          <p>Third paragraph wrapping up.</p>
        </div>
      </div>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");
    await waitFor(() => {
      // The outer wrapper has >2 grandchildren via nested divs, so it shouldn't
      // get incorrectly wrapped as media-aside
      const allParagraphs = root?.querySelectorAll("p");
      expect(allParagraphs?.length).toBeGreaterThanOrEqual(3);
      // None of them should be classified as caption (they're body text)
      expect(root?.querySelector("[data-reader-figure-caption]")).toBeNull();
    });
  });
});

describe("RenderHtml – media/image hardening", () => {
  test("keeps inline badge images out of block media frames", async () => {
    const html = `
      <p>
        <img src="https://img.shields.io/badge/CI-passing-brightgreen" alt="CI badge" />
        <img src="https://img.shields.io/badge/license-apache--2.0-blue" alt="License badge" />
      </p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      const badges = root?.querySelectorAll("img[data-reader-inline-img]");
      expect(badges?.length).toBe(2);
      expect(root?.querySelector("[data-reader-img-frame]")).toBeNull();
    });
  });

  test("removes placeholder siblings when a real image is present", async () => {
    const html = `
      <p>
        <img src="https://example.com/grey-placeholder.png" class="article-image unavailable" alt="" />
        <img src="https://example.com/real-photo.jpg" alt="Real photo" />
      </p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      const imgs = root?.querySelectorAll("img");
      expect(imgs?.length).toBe(1);
      expect(imgs?.[0]?.getAttribute("src")).toContain("real-photo.jpg");
    });
  });

  test("removes likely author social cards from article body", async () => {
    const html = `
      <div class="author-card">
        <img src="https://example.com/author.jpg" alt="Author" />
        <p>Jane Doe, editor at Example.</p>
        <a href="https://twitter.com/jane">X</a>
        <a href="https://linkedin.com/in/jane">LinkedIn</a>
      </div>
      <p>Actual article paragraph.</p>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      expect(root?.querySelector(".author-card")).toBeNull();
      expect(root?.textContent).toContain("Actual article paragraph");
    });
  });
});

describe("RenderHtml – code block normalization", () => {
  test("normalizes standalone multiline code tags into enhanced blocks", async () => {
    const html = `
      <div>
        <code class="language-bash">mydumper \\
  --threads 32 \\
  --outputdir /root/mydumper_backup/</code>
      </div>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      expect(root?.querySelector("[data-reader-code-block]")).toBeTruthy();
      expect(root?.querySelector("button[aria-label='Copy code']")).toBeTruthy();
      expect(root?.querySelector(".reader-code-lang-label")?.textContent).toBe("Bash");
    });
  });

  test("re-applies code block chrome after content remount (new article body)", async () => {
    const html = `
      <pre><code class="language-ts">const hello: string = "world"</code></pre>
    `;
    const { container, rerender } = render(
      <RenderHtml key="first" html={html} baseUrl="https://example.com/p" />,
    );
    let root = container.querySelector(".article-body");
    expect(root).toBeTruthy();

    await waitFor(() => {
      expect(root?.querySelector("[data-reader-code-block]")).toBeTruthy();
    });

    act(() => {
      rerender(<RenderHtml key="second" html={html} baseUrl="https://example.com/p" />);
    });
    root = container.querySelector(".article-body");

    await waitFor(() => {
      expect(root?.querySelector("[data-reader-code-block]")).toBeTruthy();
      expect(root?.querySelector("button[aria-label='Copy code']")).toBeTruthy();
      expect(root?.querySelector(".reader-code-lang-label")?.textContent).toBe("TypeScript");
    });
  });

  test("treats explicit fence language as authoritative", async () => {
    const html = `
      <pre><code class="language-foo">{"name":"kyomi","enabled":true}</code></pre>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      expect(root?.querySelector(".reader-code-lang-label")?.textContent).toBe("Foo");
      const code = root?.querySelector("pre code");
      expect(code?.classList.contains("language-foo")).toBe(true);
      expect(code?.querySelector("span")).toBeNull();
    });
  });

  test("defaults ambiguous snippets to bash", async () => {
    const html = `
      <pre><code>hello(world);</code></pre>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      expect(root?.querySelector(".reader-code-lang-label")?.textContent).toBe("Bash");
      const code = root?.querySelector("pre code");
      expect(code?.classList.contains("language-bash")).toBe(true);
    });
  });

  test("keeps deterministic shell detection for script snippets", async () => {
    const html = `
      <pre><code>#!/usr/bin/env bash
set -euo pipefail
for f in *.ts; do
  echo "$f"
done</code></pre>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      expect(root?.querySelector(".reader-code-lang-label")?.textContent).toBe("Bash");
      const code = root?.querySelector("pre code");
      expect(code?.classList.contains("language-bash")).toBe(true);
    });
  });
});

describe("RenderHtml – fidelity layout mode", () => {
  test("preserves image DOM structure without reader layout transforms", async () => {
    const html = `
      <div class="author-bio media-object">
        <p><img src="https://example.com/a.png" alt="" /></p>
        <p>Jane Doe is a reporter covering technology.</p>
      </div>
    `;
    const { container } = render(
      <RenderHtml html={html} baseUrl="https://example.com/p" layoutMode="fidelity" />,
    );
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      expect(root?.querySelector("div.author-bio")).toBeTruthy();
      expect(root?.querySelector("div.author-bio")?.hasAttribute("data-reader-media-aside")).toBe(
        false,
      );
      expect(root?.querySelector("[data-reader-img-frame]")).toBeNull();
      expect(root?.querySelector("[data-reader-profile-thumb]")).toBeNull();
    });
  });
});
