import { describe, expect, test } from "bun:test";
import { runThrough } from "./document-helpers";

const run = (html: string) => runThrough(html, "derive");

describe("derive (pass 17)", () => {
  test("counts words and rounds reading time up with a one minute floor", async () => {
    const short = await run(`<p>${"word ".repeat(10)}</p>`);
    expect(short.meta).toMatchObject({ wordCount: 10, readingMinutes: 1 });
    const long = await run(`<p>${"word ".repeat(500)}</p>`);
    expect(long.meta).toMatchObject({ wordCount: 500, readingMinutes: 3 });
    const empty = await run(`<hr>`);
    expect(empty.meta).toMatchObject({ wordCount: 0, readingMinutes: 0 });
  });

  test("counts CJK text by word segments", async () => {
    const draft = await run(`<p>これは日本語の文章です。</p>`);
    expect(draft.meta.wordCount).toBeGreaterThan(1);
  });

  test("lists code languages and embed providers once, in document order", async () => {
    const draft = await run(
      `<pre data-lang="ts"><code>a</code></pre><pre data-lang="py"><code>b</code></pre><pre data-lang="ts"><code>c</code></pre>
       <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><iframe src="https://player.vimeo.com/video/76979871"></iframe><iframe src="https://www.youtube.com/embed/aaaaaaaaaaa"></iframe>`,
    );
    expect(draft.features.codeLanguages).toEqual(["typescript", "python"]);
    expect(draft.features.embedProviders).toEqual(["youtube", "vimeo"]);
  });

  test("sets features.math for inline math, block math, and math in footnotes", async () => {
    expect((await run(String.raw`<p>$a$</p>`)).features.math).toBe(true);
    expect((await run(String.raw`<p>$$a$$</p>`)).features.math).toBe(true);
    expect(
      (
        await run(
          String.raw`<p>x<a href="#n">1</a></p><ol class="footnotes"><li id="n">$a$</li></ol>`,
        )
      ).features.math,
    ).toBe(true);
    expect((await run(`<p>No math</p>`)).features.math).toBe(false);
  });

  test("counts html blocks, nested ones included", async () => {
    const deep = `${"<div>".repeat(60)}<p>Deep</p>${"</div>".repeat(60)}`;
    const draft = await run(`${deep}<blockquote>${deep}</blockquote>`);
    expect(draft.diagnostics.htmlBlocks).toBe(2);
  });
});
