import { describe, expect, test } from "bun:test";
import { runThrough } from "./document-helpers";

const run = (html: string) => runThrough(html, "math");

describe("math (pass 14)", () => {
  test("converts $…$, \\(…\\), $$…$$ and \\[…\\] delimiters and renders KaTeX", async () => {
    const draft = await run(
      String.raw`<p>Inline $a^2$ and \(b_1\).</p><p>$$\int_0^1 x\,dx$$</p><p>\[E=mc^2\]</p>`,
    );
    expect(draft.blocks[0]).toMatchObject({
      children: [
        { value: "Inline " },
        { type: "math", tex: "a^2" },
        { value: " and " },
        { type: "math", tex: "b_1" },
        { value: "." },
      ],
    });
    expect(draft.blocks[1]).toMatchObject({ type: "math", tex: String.raw`\int_0^1 x\,dx` });
    expect(draft.blocks[2]).toMatchObject({ type: "math", tex: "E=mc^2" });
    for (const block of [draft.blocks[1], draft.blocks[2]]) {
      expect(block).toMatchObject({ rendered: expect.stringContaining("katex-display") });
    }
  });

  test("renders htmlAndMathml with trust disabled", async () => {
    const draft = await run(String.raw`<p>$x^2$ $\href{javascript:alert(1)}{click}$</p>`);
    const [first, , second] = (
      draft.blocks[0] as { children: { rendered?: string }[] }
    ).children.slice(0, 3);
    expect(first?.rendered).toContain("katex-mathml");
    expect(first?.rendered).toContain("katex-html");
    // \href is a trusted command: with trust off KaTeX renders it as inert text, never a link.
    expect(second?.rendered ?? "").not.toMatch(/<a\b|href=/);
  });

  test("leaves prices and bare TeX in prose alone", async () => {
    const draft = await run(
      String.raw`<p>It costs $5 a month or $50 a year, and \alpha is just a word, as is x^2.</p>`,
    );
    expect(draft.blocks[0]).toMatchObject({ children: [{ type: "text" }] });
  });

  test("does not touch code, inline or block", async () => {
    const draft = await run(String.raw`<p><code>$a$</code></p><pre><code>$$b$$</code></pre>`);
    expect(JSON.stringify(draft.blocks)).not.toContain('"math"');
  });

  test("recognizes math environments but not arbitrary \\begin blocks", async () => {
    const draft = await run(
      String.raw`<p>\begin{align}a &amp;= b \\ c &amp;= d\end{align}</p><p>\begin{matrix}1\end{matrix}</p>`,
    );
    expect(draft.blocks[0]).toMatchObject({ type: "math", rendered: expect.any(String) });
    expect(draft.blocks[1]).toMatchObject({ type: "paragraph" });
  });

  test("keeps TeX only when rendering fails, and records a warning", async () => {
    const draft = await run(String.raw`<p>Broken $\frac{1$ here</p>`);
    expect(draft.blocks[0]).toMatchObject({
      children: [{}, { type: "math", tex: String.raw`\frac{1` }, {}],
    });
    const math = (draft.blocks[0] as { children: Record<string, unknown>[] }).children[1]!;
    expect(math).not.toHaveProperty("rendered");
    expect(draft.diagnostics.warnings).toContain("math-render-failed");
  });

  test("applies expansion limits to runaway macros", async () => {
    const draft = await run(String.raw`<p>$\def\a{\a\a}\a$</p>`);
    const math = (draft.blocks[0] as { children: Record<string, unknown>[] }).children[0]!;
    expect(math.type).toBe("math");
    expect(math).not.toHaveProperty("rendered");
  });

  test("renders publisher TeX and keeps MathML-only math as MathML", async () => {
    const draft = await run(
      `<p><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math> and <math><mi>y</mi></math></p>`,
    );
    const [withTex, , mathmlOnly] = (draft.blocks[0] as { children: Record<string, unknown>[] })
      .children;
    expect(withTex).toMatchObject({ tex: "x^2", rendered: expect.stringContaining("katex") });
    expect(mathmlOnly).toMatchObject({ mathml: expect.stringContaining("<mi>y</mi>") });
    expect(mathmlOnly).not.toHaveProperty("rendered");
  });

  test("finds math in footnotes, table cells, and headings", async () => {
    const draft = await run(
      String.raw`<h2>About $a$</h2><table><tr><td>$b$</td></tr></table><p>N<a href="#n">1</a></p><ol class="footnotes"><li id="n">Note $c$</li></ol>`,
    );
    expect(JSON.stringify(draft.blocks)).toContain('"tex":"a"');
    expect(JSON.stringify(draft.blocks)).toContain('"tex":"b"');
    expect(JSON.stringify(draft.footnotes)).toContain('"tex":"c"');
  });
});
