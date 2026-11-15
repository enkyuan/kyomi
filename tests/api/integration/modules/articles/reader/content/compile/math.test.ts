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

  test("keeps TeX only when an explicit \\(…\\) fails to render, and records a warning", async () => {
    const draft = await run(String.raw`<p>Broken \(\frac{1\) here</p>`);
    expect(draft.blocks[0]).toMatchObject({
      children: [{}, { type: "math", tex: String.raw`\frac{1` }, {}],
    });
    const math = (draft.blocks[0] as { children: Record<string, unknown>[] }).children[1]!;
    expect(math).not.toHaveProperty("rendered");
    expect(draft.diagnostics.warnings).toContain("math-render-failed");
  });

  test("a `$…$` or `$$…$$` span that is not valid TeX goes back to the text it was", async () => {
    const draft = await run(
      String.raw`<p>Broken $\frac{1$ here and $$\undefinedmacro{x}$$ there</p>`,
    );
    expect(draft.blocks[0]).toMatchObject({ type: "paragraph" });
    expect(JSON.stringify(draft.blocks)).not.toContain('"math"');
    expect(JSON.stringify(draft.blocks)).toContain(String.raw`$\\frac{1$`);
    expect(JSON.stringify(draft.blocks)).toContain(String.raw`$$\\undefinedmacro{x}$$`);
    expect(draft.diagnostics.warnings).toContain("math-render-failed");
  });

  test("applies expansion limits to runaway macros", async () => {
    const draft = await run(String.raw`<p>\(\def\a{\a\a}\a\)</p>`);
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

  test.each([
    ["US prices", "Ethereum is steady at US$78,601, or about $5 and $10 a month."],
    [
      "currency in parentheses",
      "operating profit of A$49.2b), up 2.5 per cent, and (US$30.7b) cash",
    ],
    [
      "slang and price tiers",
      "Price range: $$$$ for a night, and save some $$$ while you $$ spend.",
    ],
    ["shell variables", "Add $HOME/go to $PATH: export PATH=$PATH:$HOME/bin and echo $USER"],
    [
      "PowerShell",
      "$credential = New-Object System.Management.Automation.PSCredential($user, $pass)",
    ],
    ["a command substitution", `Run $(rclone obscure "$PASSWORD") then ${"`$x`"}`],
    ["prose between dollars", "the $CO noticed listeners from Poland engaging with $"],
    ["tickers", "Applied Materials ($AMAT) and Alibaba ($BABA) rose"],
    ["typographic quotes", "the files $-name “*.txt” -or -name “*.pdf”$ matched"],
    ["a currency range", "between $2,000–$12,000 depending"],
    ["tcl and shell variable lists", "lappend $Y,$Z; then source $BIN_DIR/env.conf $db_conf"],
    ["a spreadsheet formula", "=COUNTIFS($A$3:$A$15,$A3,$D$3:$D$15,$D3)>1"],
    ["sigil-only spans", "Sigh. %$@$ and ($($)"],
    ["a price range", "a dose costs $.57-$.67 per day"],
    ["escaped shell parentheses", String.raw`find . \( -name "*.txt" -o -name "*.pdf" \) -print`],
    ["escaped shell parentheses with curly quotes", "find \\( -name “*.txt” -or -name “*.pdf” \\)"],
  ])("leaves %s alone", async (_name, text) => {
    const draft = await run(`<p>${text}</p>`);
    expect(JSON.stringify(draft.blocks)).not.toContain('"math"');
  });

  test.each([
    ["a single variable", String.raw`the set $S$ is`, "S"],
    ["a variable before a hyphen", String.raw`tests which have $p$-values near`, "p"],
    ["a degree value", String.raw`($100^\circ\text{C}$)`, String.raw`100^\circ\text{C}`],
    [
      "a named text command with letters",
      String.raw`so $c_0' = \textup{round}\left(\frac{c_0}{Q}\right)$.`,
      String.raw`c_0' = \textup{round}\left(\frac{c_0}{Q}\right)`,
    ],
    [
      "non-breaking spaces from the source",
      "see $\\frac{3}{10} + \\frac{3}{10}$.",
      "\\frac{3}{10} + \\frac{3}{10}",
    ],
    [
      "an en dash between structured terms",
      String.raw`range $20^\circ\text{C} – 40^\circ\text{C}$ is`,
      String.raw`20^\circ\text{C} – 40^\circ\text{C}`,
    ],
    [
      "a formula with Greek letters",
      String.raw`where $\alpha + \beta = \gamma$ holds`,
      String.raw`\alpha + \beta = \gamma`,
    ],
    ["a formula starting with a digit", String.raw`since $2x + 1 = 5$ gives`, "2x + 1 = 5"],
  ])("recognizes %s", async (_name, text, tex) => {
    const draft = await run(`<p>${text}</p>`);
    const found = (draft.blocks[0] as { children: { type: string; tex?: string }[] }).children.find(
      (child) => child.type === "math",
    );
    expect(found?.tex).toBe(tex);
  });

  test("renders a formula mid-paragraph with `\\(` even when it holds plain words in \\text", async () => {
    const draft = await run(String.raw`<p>\(\text{Space between frames} = \frac{a}{b}\)</p>`);
    expect(draft.blocks[0]).toMatchObject({
      children: [{ type: "math", rendered: expect.any(String) }],
    });
  });

  test("$$$ is never display math", async () => {
    const draft = await run(String.raw`<p>It was $$$ at the start and $$$ at the end</p>`);
    expect(JSON.stringify(draft.blocks)).not.toContain('"math"');
  });

  test("a display equation inside a paragraph splits it into text, a math block and text", async () => {
    const draft = await run(
      String.raw`<p>We know that $$a^2 + b^2 = c^2$$ holds, and then \[x = 1\] again with $y$ inline.</p>`,
    );
    expect(draft.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "text", value: "We know that" }] },
      { type: "math", tex: "a^2 + b^2 = c^2", rendered: expect.stringContaining("katex-display") },
      { type: "paragraph", children: [{ type: "text", value: "holds, and then" }] },
      { type: "math", tex: "x = 1" },
      {
        type: "paragraph",
        children: [{ value: "again with " }, { type: "math", tex: "y" }, { value: " inline." }],
      },
    ]);
  });

  test("splitting keeps the anchor on the first piece and works inside list items", async () => {
    const draft = await run(
      String.raw`<p id="p1">Start $$\begin{aligned} a &amp;= b \\ c &amp;= d \end{aligned}$$ end</p><ul><li>item $$z$$ after</li></ul>`,
    );
    expect(draft.blocks[0]).toMatchObject({ type: "paragraph", anchor: expect.any(String) });
    expect(draft.blocks[1]).toMatchObject({ type: "math" });
    expect(draft.blocks[1]).not.toHaveProperty("anchor");
    const list = draft.blocks[3] as { items: { children: { type: string }[] }[] };
    expect(list.items[0]?.children.map((child) => child.type)).toEqual([
      "paragraph",
      "math",
      "paragraph",
    ]);
  });

  test("keeps inline math and text-only paragraphs untouched", async () => {
    const draft = await run(String.raw`<p>just $x$ here</p><p>plain</p>`);
    expect(draft.blocks).toHaveLength(2);
  });
});
