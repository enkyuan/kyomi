import { describe, expect, test } from "bun:test";
import { compileArticleDocument } from "@kyomi/worker/document";
import { readerDocumentSchema } from "@kyomi/reader/document";
import { isSafeMathSvg, MAX_MATH_SVG_LENGTH } from "@kyomi/reader/document/math-svg";

type Inline = { type: string; tex?: string; svg?: string; mathml?: string; children?: Inline[] };

async function inlineMath(body: string, withoutTex = false): Promise<Inline[]> {
  const result = await compileArticleDocument({ body, origin: "feed_html" });
  expect(result.document).not.toBeNull();
  expect(readerDocumentSchema.safeParse(result.document).success).toBe(true);
  const found: Inline[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      const node = value as Inline;
      if (node.type === "math" && (withoutTex || node.tex !== undefined)) {
        found.push(node);
      }
      Object.values(value).forEach(visit);
    }
  };
  visit(result.document?.blocks);
  return found;
}

describe("inline math svg", () => {
  test("renders a self-contained svg for layout-heavy inline formulas", async () => {
    const [node] = await inlineMath(
      String.raw`<p>See \(\frac{a}{\sqrt{x}} + \sum_{i=1}^n i\) here.</p>`,
    );
    expect(node?.svg).toBeDefined();
    expect(node?.svg).toStartWith("<svg");
    expect(node?.svg).toContain('stroke="currentColor"');
    expect(node?.svg).not.toContain("<use");
    expect(isSafeMathSvg(node?.svg ?? "")).toBe(true);
  });

  test("renders matrices", async () => {
    const [node] = await inlineMath(
      String.raw`<p>\(\begin{pmatrix} a & b \\ c & d \end{pmatrix}\)</p>`,
    );
    expect(node?.svg).toBeDefined();
  });

  test("omits svg for invalid TeX without throwing", async () => {
    const [node] = await inlineMath(String.raw`<p>\(\frac{a\)</p>`);
    expect(node?.tex).toBeDefined();
    expect(node?.svg).toBeUndefined();
  });

  test("drops links and script-bearing macros from hostile input", async () => {
    const nodes = await inlineMath(
      String.raw`<p>\(\href{javascript:alert(1)}{x}\) and \(\require{html}\style{color:red}{y}\) and \(\unicode{x3C}script\)</p>`,
    );
    for (const node of nodes) {
      if (node.svg) {
        expect(node.svg).not.toMatch(/javascript:|<script|<a[ >]|onload|foreignObject/i);
        expect(isSafeMathSvg(node.svg)).toBe(true);
      }
    }
  });

  test.each([
    ["a baseline-aligned formula (vertical-align: 0)", String.raw`\(\mathbb{R}^n\)`],
    ["a space glyph with an empty path", String.raw`\(\text{if } x > 0\)`],
    ["a colour", String.raw`\(\color{red} x + y\)`],
    ["a text colour", String.raw`\(\textcolor{#336699}{x}\)`],
    ["a background colour", String.raw`\(\colorbox{yellow}{x}\)`],
    ["a rule", String.raw`\(a \rule{1em}{1pt} b\)`],
    ["an ellipsis", String.raw`\(a \dots b\)`],
    ["limits", String.raw`\(\lim_{x \to 0} \sin x\)`],
    ["chemistry", String.raw`\(\ce{H2O + CO2 -> H2CO3}\)`],
    [
      "a cases environment",
      String.raw`\(f(x) = \begin{cases} 1 & x > 0 \\ 0 & \text{else} \end{cases}\)`,
    ],
    ["bold math", String.raw`\(\boldsymbol{\alpha} + \bm{x}\)`],
    [
      "operatorname, dfrac, underbrace, xrightarrow",
      String.raw`\(\operatorname{softmax}\dfrac{a}{b} \underbrace{x}_{n} \xrightarrow{f}\)`,
    ],
    ["cancel and boxed", String.raw`\(\cancel{x} + \boxed{y}\)`],
    ["mathcal and mathfrak", String.raw`\(\mathcal{L} \mathfrak{g}\)`],
  ])("draws %s", async (_name, source) => {
    const [node] = await inlineMath(`<p>${source}</p>`);
    expect(node?.rendered).toBeDefined();
    expect(node?.svg).toBeDefined();
    expect(isSafeMathSvg(node?.svg ?? "")).toBe(true);
  });

  test("does not draw what KaTeX rejects, so web and native agree", async () => {
    // `noundefined` would turn \foo into red source text and plain TeX accepts \eqalign, KaTeX neither.
    for (const source of [
      String.raw`\(\foo{x}\)`,
      String.raw`\(\eqalign{a &= b}\)`,
      String.raw`\(\frac{a\)`,
    ]) {
      const [node] = await inlineMath(`<p>${source}</p>`);
      expect(node?.tex).toBeDefined();
      expect(node?.rendered).toBeUndefined();
      expect(node?.svg).toBeUndefined();
    }
  });

  test("display math nested in emphasis stays inline and is drawn as SVG", async () => {
    const [inline] = await inlineMath(String.raw`<p>so <em>$$a^2 + b^2 = c^2$$</em> holds</p>`);
    expect(inline?.svg).toBeDefined();
  });

  test("MathML-only formulas get an SVG when they are plain presentation MathML", async () => {
    const [power] = await inlineMath(
      `<p>about <math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mn>2</mn><mn>20</mn></msup></math> bytes</p>`,
      true,
    );
    expect(power?.tex).toBeUndefined();
    expect(power?.svg).toBeDefined();
    expect(isSafeMathSvg(power?.svg ?? "")).toBe(true);
  });

  test("MathML with HTML inside its tokens keeps no SVG", async () => {
    const found = await inlineMath(
      `<p><math><mtext><span>hello</span></mtext></math> and <math><mi>x</mi></math></p>`,
      true,
    );
    expect(found.find((node) => node.svg === undefined)).toBeDefined();
  });

  test("caps formulas per document and never throws on huge input", async () => {
    const body = `<p>${Array.from({ length: 450 }, (_, i) => `\\(x_{${i}}^2\\)`).join(" ")}</p>`;
    const nodes = await inlineMath(body);
    expect(nodes.filter((node) => node.svg).length).toBeLessThanOrEqual(300);
    const huge = await inlineMath(`<p>\\(${"\\frac{a}{b}+".repeat(150)}1\\)</p>`);
    for (const node of huge) {
      expect((node.svg ?? "").length).toBeLessThanOrEqual(MAX_MATH_SVG_LENGTH);
    }
  });
});

describe("isSafeMathSvg", () => {
  const ok = `<svg xmlns="http://www.w3.org/2000/svg" width="1ex" height="2ex" viewBox="0 0 10 20" style="vertical-align: -0.5ex;"><g fill="currentColor"><path d="M0 0L10 20Z"/></g></svg>`;

  test("accepts a minimal MathJax-shaped svg", () => {
    expect(isSafeMathSvg(ok)).toBe(true);
  });

  test("accepts a unitless zero baseline, an empty path, and hex or named paint", () => {
    expect(isSafeMathSvg(ok.replace("vertical-align: -0.5ex;", "vertical-align: 0;"))).toBe(true);
    expect(isSafeMathSvg(ok.replace('d="M0 0L10 20Z"', 'd=""'))).toBe(true);
    expect(isSafeMathSvg(ok.replace('fill="currentColor"', 'fill="red"'))).toBe(true);
    expect(isSafeMathSvg(ok.replace('fill="currentColor"', 'fill="#a1b2c3"'))).toBe(true);
    expect(
      isSafeMathSvg(ok.replace("<path", '<rect data-bgcolor="true" width="1" height="1"/><path')),
    ).toBe(true);
  });

  test.each([
    ["script tag", ok.replace("<g", "<script>alert(1)</script><g")],
    ["foreignObject", ok.replace("<g", "<foreignObject><div/></foreignObject><g")],
    ["event handler", ok.replace("<g ", '<g onload="alert(1)" ')],
    ["external href", ok.replace("<path", '<use href="https://evil.test/x.svg"/><path')],
    ["anchor", ok.replace("<g", '<a href="javascript:alert(1)"><g').replace("</g>", "</g></a>")],
    ["url() paint", ok.replace('fill="currentColor"', 'fill="url(https://evil.test/x)"')],
    ["gradient paint", ok.replace('fill="currentColor"', 'fill="url(#a)"')],
    ["css paint", ok.replace('fill="currentColor"', 'fill="red;background:url(x)"')],
    ["unitless non-zero baseline", ok.replace("-0.5ex;", "5;")],
    ["style injection", ok.replace("vertical-align: -0.5ex;", "background:url(//evil.test)")],
    ["text content", ok.replace("<g", "hello<g")],
    ["comment", ok.replace("<g", "<!-- x --><g")],
    ["unbalanced", ok.replace("</g>", "")],
    ["trailing content", `${ok}<svg xmlns="http://www.w3.org/2000/svg"></svg>`],
    ["not svg", "<div></div>"],
    ["oversized", ok.replace("</svg>", `${"<g/>".repeat(MAX_MATH_SVG_LENGTH)}</svg>`)],
  ])("rejects %s", (_name, svg) => {
    expect(isSafeMathSvg(svg)).toBe(false);
  });
});
