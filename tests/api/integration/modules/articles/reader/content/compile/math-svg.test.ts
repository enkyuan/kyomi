import { describe, expect, test } from "bun:test";
import { compileArticleDocument } from "@kyomi/worker/document";
import { readerDocumentSchema } from "@kyomi/reader/document";
import { isSafeMathSvg, MAX_MATH_SVG_LENGTH } from "@kyomi/reader/document/math-svg";

type Inline = { type: string; tex?: string; svg?: string; children?: Inline[] };

async function inlineMath(body: string): Promise<Inline[]> {
  const result = await compileArticleDocument({ body, origin: "feed_html" });
  expect(result.document).not.toBeNull();
  expect(readerDocumentSchema.safeParse(result.document).success).toBe(true);
  const found: Inline[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      const node = value as Inline;
      if (node.type === "math" && node.tex !== undefined) {
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

  test.each([
    ["script tag", ok.replace("<g", "<script>alert(1)</script><g")],
    ["foreignObject", ok.replace("<g", "<foreignObject><div/></foreignObject><g")],
    ["event handler", ok.replace("<g ", '<g onload="alert(1)" ')],
    ["external href", ok.replace("<path", '<use href="https://evil.test/x.svg"/><path')],
    ["anchor", ok.replace("<g", '<a href="javascript:alert(1)"><g').replace("</g>", "</g></a>")],
    ["url() paint", ok.replace('fill="currentColor"', 'fill="url(https://evil.test/x)"')],
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
