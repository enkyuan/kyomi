// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { RenderDocument } from "@kyomi/reader/web";
import { isTrustedKatexHtml } from "../../../../../../../../packages/reader/src/web/document/katex-html";
import { documentOf } from "./fixtures";

// KaTeX is a dependency of the reader package, not of the tests workspace.
const requireFromReader = createRequire(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../../../../../packages/reader/package.json",
  ),
);
const katex = requireFromReader("katex") as {
  renderToString(tex: string, options: Record<string, unknown>): string;
};
requireFromReader("katex/contrib/mhchem");

/** The compiler's call (`packages/ingest/src/document/passes/math.ts`). */
const compile = (tex: string, displayMode: boolean) =>
  katex.renderToString(tex, {
    displayMode,
    output: "htmlAndMathml",
    throwOnError: true,
    trust: false,
    strict: "ignore",
  });

/** Formulas KaTeX only accepts in display mode. */
const DISPLAY_ONLY = [
  String.raw`\tag{1} x = 1`,
  String.raw`\begin{CD}A @>a>> B \\ @VVV @AAA \\ C @= D\end{CD}`,
];

const FORMULAS = [
  String.raw`x^2 + y_1`,
  String.raw`\frac{a}{b} + \dfrac{1}{2}`,
  String.raw`\sqrt{x} + \sqrt[3]{x^2 + 1}`,
  String.raw`\sum_{i=0}^{n} i = \frac{n(n+1)}{2}`,
  String.raw`\int_0^\infty e^{-x}\,dx`,
  String.raw`\begin{pmatrix}a & b \\ c & d\end{pmatrix}`,
  String.raw`\begin{cases}a & b \\ c & d\end{cases}`,
  String.raw`\begin{array}{|c|c|}\hline a & b \\\hline c & d \\\hline\end{array}`,
  String.raw`\begin{aligned}a &= b \\ c &= d\end{aligned}`,
  String.raw`\overrightarrow{AB} \xrightarrow{abc} \widehat{xyz} \overbrace{a+b}^{n}`,
  String.raw`\cancel{x} \boxed{a+b} \colorbox{yellow}{y} \fcolorbox{red}{blue}{z} \textcolor{red}{x}`,
  String.raw`\mathbb{R} \mathcal{L} \mathfrak{g} \mathscr{S} \mathbf{x} \boldsymbol{\alpha}`,
  String.raw`\text{plain 日本語 한국어 Русский} \textbf{bold}`,
  String.raw`\left(\frac{a}{b}\right) \Big( \bigg] \left\langle x \right\rangle`,
  String.raw`\mathrm{d}x \operatorname{sin} \lim_{n\to\infty}`,
  String.raw`\rule{1em}{2pt} \hspace{1em} \, \; \: \! \quad \phantom{x} \smash{w} \tiny a \Huge b`,
  String.raw`\ce{H2O + CO2 -> H2CO3} \pu{1.5 mol/L}`,
  String.raw`a \bmod b \pmod{n} \not= \neq \binom{n}{k} \stackrel{a}{=}`,
];

describe("isTrustedKatexHtml", () => {
  test.each([
    ...FORMULAS.flatMap((tex) => [[tex, false] as const, [tex, true] as const]),
    ...DISPLAY_ONLY.map((tex) => [tex, true] as const),
  ])("accepts the compiler's KaTeX output for %s (display: %s)", (tex, display) => {
    expect(isTrustedKatexHtml(compile(tex, display))).toBe(true);
  });

  test("accepts every class in KaTeX's own stylesheet, so a KaTeX upgrade that adds one fails here", () => {
    const css = readFileSync(requireFromReader.resolve("katex/dist/katex.css"), "utf8")
      .replace(/@font-face\{[^}]*\}/g, "")
      .replace(/\{[^{}]*\}/g, "{}");
    const classes = new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]));
    expect(classes.size).toBeGreaterThan(100);
    for (const name of classes) {
      if (name === "katex-version") {
        continue;
      }
      expect(isTrustedKatexHtml(`<span class="${name}">x</span>`), name).toBe(true);
    }
  });

  test.each([
    ["a script element", '<span class="katex"><script>alert(1)</script></span>'],
    ["an event handler", '<span class="katex" onclick="alert(1)">x</span>'],
    ["a handler after a newline", '<span class="katex"\nonclick="alert(1)">x</span>'],
    ["a handler after a tab", '<span class="katex"\tonclick="alert(1)">x</span>'],
    ["an image", '<span class="katex"><img src=x onerror="alert(1)"></span>'],
    ["a javascript: link", '<span class="katex"><a href="javascript:alert(1)">x</a></span>'],
    [
      "an animated svg href",
      '<span class="katex"><svg><animate attributeName="href" to="javascript:alert(1)"/></svg></span>',
    ],
    ["an svg use", '<span class="katex"><svg><use href="#a"/></svg></span>'],
    [
      "a foreign svg namespace",
      '<span class="katex"><svg xmlns="http://evil.example"><path d="M0"/></svg></span>',
    ],
    [
      "a handler on a path",
      '<span class="katex"><svg><path d="M0 0" onload="alert(1)"/></svg></span>',
    ],
    ["a style element", '<span class="katex"><style>*{display:none}</style></span>'],
    [
      "a mutation-XSS style in math",
      '<span class="katex"><math><mtext><style><img src=x onerror=1></style></mtext></math></span>',
    ],
    [
      "annotation-xml with HTML",
      '<span class="katex"><math><annotation-xml encoding="text/html"><img src=x></annotation-xml></math></span>',
    ],
    ["an mglyph with a src", '<span class="katex"><math><mglyph src="x"/></math></span>'],
    ["an iframe", '<span class="katex"><iframe srcdoc="x"></iframe></span>'],
    ["a comment", '<!-- x --><span class="katex">x</span>'],
    ["a CDATA section", '<span class="katex"><![CDATA[x]]></span>'],
    ["an upper case tag", '<SPAN class="katex">x</SPAN>'],
    [
      "a url() in a style",
      '<span class="katex" style="background-color:url(https://evil.example/x)">x</span>',
    ],
    ["an escaped url() in a style", '<span class="katex" style="color:\\75rl(x)">x</span>'],
    [
      "a fixed overlay style",
      '<span class="katex" style="position:fixed;top:0;left:0;width:100%;height:100%">x</span>',
    ],
    ["an unknown style property", '<span class="katex" style="pointer-events:none">x</span>'],
    ["app utility classes", '<span class="fixed inset-0 z-50">x</span>'],
    ["a KaTeX class beside a utility class", '<span class="katex fixed">x</span>'],
    ["an id", '<span class="katex" id="kyomi-command-description">x</span>'],
    ["a data attribute", '<span class="katex" data-x="1">x</span>'],
    ["an entity in an attribute", '<span class="katex" title="&quot;">x</span>'],
    ["a prototype key as an attribute", '<span class="katex" constructor="x">x</span>'],
    ["a prototype key as an attribute (__proto__)", '<span class="katex" __proto__="x">x</span>'],
    ["HTML inside svg", '<span class="katex"><svg><span>x</span></svg></span>'],
    ["svg inside math", '<span class="katex"><math><svg></svg></math></span>'],
    ["MathML outside math", '<span class="katex"><mi>x</mi></span>'],
    [
      "a bare root other than span",
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>',
    ],
    ["text outside the root", '<span class="katex">x</span>tail'],
    ["a second root", '<span class="katex">a</span><span class="katex">b</span>'],
    ["an unclosed element", '<span class="katex"><span>x</span>'],
    ["an extra closing tag", '<span class="katex">x</span></span>'],
    ["a raw > in text", '<span class="katex">a > b</span>'],
    ["empty input", ""],
  ])("refuses %s", (_name, html) => {
    expect(isTrustedKatexHtml(html)).toBe(false);
  });

  test("scans hostile input in linear time", () => {
    const deep = `<span class="katex">${'<span class="mord">'.repeat(50_000)}x${"</span>".repeat(50_000)}</span>`;
    for (const html of [
      deep,
      "<".repeat(200_000),
      `<span class="katex"${' a="b"'.repeat(30_000)}>`,
      `<span class="katex"${" ".repeat(200_000)}>`,
    ]) {
      const start = performance.now();
      isTrustedKatexHtml(html);
      expect(performance.now() - start).toBeLessThan(1_000);
    }
  });
});

describe("math blocks", () => {
  test("render the compiler's KaTeX output as-is", () => {
    const rendered = compile(String.raw`\frac{a}{b} + \sqrt{x}`, true);
    const { container } = render(
      <RenderDocument document={documentOf([{ type: "math", tex: "a", rendered }])} />,
    );
    const block = container.querySelector("div[data-reader-math='block']");
    // Compared as the parser serializes it (`<path/>` becomes `<path></path>`).
    const template = document.createElement("template");
    template.innerHTML = rendered;
    expect(block?.innerHTML).toBe(template.innerHTML);
    expect(block?.querySelector("svg")).toBeTruthy();
  });

  // Each of these passed the denylist this allowlist replaced (no `<script`, no whitespace before
  // `on*=`, no literal `javascript:`).
  test.each([
    ["a slash-separated handler", '<span class="katex"><img src=x/onerror=alert(1)></span>'],
    [
      "an entity-encoded javascript: link",
      '<span class="katex"><a href="jav&#x61;script:alert(1)">x</a></span>',
    ],
    [
      "an animated svg href",
      '<span class="katex"><svg><animate attributeName="href" to="jav&#x61;script:alert(1)"/></svg></span>',
    ],
    [
      "an object element",
      '<span class="katex"><object data="https://evil.example/x"></object></span>',
    ],
    [
      "a meta refresh",
      '<span class="katex"><meta http-equiv="refresh" content="0;url=https://evil.example"></span>',
    ],
  ])("show the TeX instead of KaTeX output with %s", (_name, rendered) => {
    const { container } = render(
      <RenderDocument document={documentOf([{ type: "math", tex: "a+b", rendered }])} />,
    );
    const block = container.querySelector("div[data-reader-math='block']");
    expect(block?.querySelector("a, svg, img, object, meta, animate")).toBeNull();
    expect(block?.querySelector("code")?.textContent).toBe("a+b");
  });
});
