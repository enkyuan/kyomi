import { describe, expect, test } from "bun:test";
import {
  fitMathLayout,
  layoutMathSvg,
  mathmlToPlainText,
  texToUnicode,
} from "../../../../../packages/reader/src/native/document/tex";

describe("texToUnicode", () => {
  test("converts symbols and scripts that have Unicode forms", () => {
    expect(texToUnicode("\\alpha + \\beta")).toBe("α + β");
    expect(texToUnicode("x^2")).toBe("x²");
    expect(texToUnicode("a_{12}")).toBe("a₁₂");
    expect(texToUnicode("n \\geq 0")).toBe("n ≥ 0");
    expect(texToUnicode("a - b")).toBe("a − b");
  });

  test("returns null when the formula needs real layout", () => {
    expect(texToUnicode("\\frac{a}{b}")).toBeNull();
    expect(texToUnicode("\\sqrt{x}")).toBeNull();
    expect(texToUnicode("x^{\\alpha}")).toBeNull();
    expect(texToUnicode("e^{ix}")).toBeNull();
    expect(texToUnicode("\\unknown")).toBeNull();
    expect(texToUnicode("{a}")).toBeNull();
  });
});

describe("layoutMathSvg", () => {
  const svg = `<svg style="vertical-align: -1ex;" xmlns="http://www.w3.org/2000/svg" width="10ex" height="3ex" viewBox="0 0 10 3"><g stroke="currentColor" fill="currentColor"></g></svg>`;
  const make = (attributes: string) =>
    `<svg ${attributes} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g stroke="currentColor"></g></svg>`;

  test("converts ex to points (one ex is 0.442em), reads descent, and applies the colour", () => {
    const layout = layoutMathSvg(svg, 20, "#112233");
    expect(layout?.width).toBeCloseTo(88.4);
    expect(layout?.height).toBeCloseTo(26.52);
    expect(layout?.descent).toBeCloseTo(8.84);
    expect(layout?.xml).not.toContain("currentColor");
    expect(layout?.xml).toContain("#112233");
  });

  test("returns null without readable sizes and ignores hostile colours", () => {
    expect(layoutMathSvg("<svg></svg>", 16, "#000")).toBeNull();
    expect(layoutMathSvg(svg, 16, '"><script>')?.xml).not.toContain("script");
  });

  test("handles a bare zero, a missing, a positive and an e-notation vertical-align", () => {
    const zero = layoutMathSvg(
      make('style="vertical-align: 0;" width="2ex" height="1ex"'),
      10,
      "#000",
    );
    expect(zero?.descent).toBe(0);
    const none = layoutMathSvg(make('width="2ex" height="1ex"'), 10, "#000");
    expect(none?.descent).toBe(0);
    // A raised formula (a degree sign) has a negative descent: the box moves up, not down.
    const raised = layoutMathSvg(
      make('style="vertical-align: 1.226ex;" width="2ex" height="1ex"'),
      10,
      "#000",
    );
    expect(raised?.descent).toBeCloseTo(-5.419, 2);
    const tiny = layoutMathSvg(
      make('style="vertical-align: -2.5e-7ex;" width="1.5e1ex" height="4e-1ex"'),
      10,
      "#000",
    );
    expect(tiny?.width).toBeCloseTo(66.3);
    expect(tiny?.height).toBeCloseTo(1.768);
    expect(tiny?.descent).toBeCloseTo(0, 5);
  });

  test("rejects sizes that are not finite ex lengths", () => {
    expect(layoutMathSvg(make('width="100%" height="1ex"'), 16, "#000")).toBeNull();
    expect(layoutMathSvg(make('width="0ex" height="1ex"'), 16, "#000")).toBeNull();
    expect(layoutMathSvg(make('width="-2ex" height="1ex"'), 16, "#000")).toBeNull();
  });

  test("reads the root size, not a nested element's", () => {
    const nested = `<svg width="4ex" height="2ex" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="99ex" height="99ex"/></svg>`;
    expect(layoutMathSvg(nested, 10, "#000")?.width).toBeCloseTo(17.68);
  });

  test("literal black (a \\rule) follows the theme colour so it stays visible in dark mode", () => {
    const rule = `<svg width="1ex" height="1ex" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="black" width="1" height="1"/></svg>`;
    expect(layoutMathSvg(rule, 16, "#f7f7f7")?.xml).toContain('fill="#f7f7f7"');
  });
});

describe("fitMathLayout", () => {
  const layout = { xml: "<svg/>", width: 400, height: 40, descent: 10 };

  test("leaves a formula that fits, and ignores a missing column width", () => {
    expect(fitMathLayout(layout, 400)).toMatchObject({ scroll: false, layout });
    expect(fitMathLayout(layout, 0).layout).toBe(layout);
    expect(fitMathLayout(layout, Number.NaN).layout).toBe(layout);
  });

  test("scales a modestly wide formula uniformly to the column", () => {
    const fit = fitMathLayout(layout, 280);
    expect(fit.scroll).toBe(false);
    expect(fit.layout.width).toBe(280);
    expect(fit.layout.height).toBeCloseTo(28);
    expect(fit.layout.descent).toBeCloseTo(7);
    expect(fit.natural).toBe(layout);
  });

  test("a formula that would shrink below 60% keeps its size in a column-wide scroll box", () => {
    const fit = fitMathLayout(layout, 200);
    expect(fit.scroll).toBe(true);
    expect(fit.layout).toMatchObject({ width: 200, height: 40, descent: 10 });
    expect(fit.natural.width).toBe(400);
  });
});

describe("mathmlToPlainText", () => {
  test("flattens token runs and decodes entities", () => {
    expect(
      mathmlToPlainText("<math><mi>x</mi><mo>=</mo><mn>1</mn><mo>&lt;</mo><mi>y</mi></math>"),
    ).toBe("x=1<y");
    expect(
      mathmlToPlainText("<math><semantics><mi>α</mi><annotation>a</annotation></semantics></math>"),
    ).toBe("α");
  });

  test("refuses layout that flattening would misread", () => {
    expect(mathmlToPlainText("<math><msup><mn>2</mn><mn>20</mn></msup></math>")).toBeNull();
    expect(mathmlToPlainText("<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>")).toBeNull();
    expect(mathmlToPlainText("<math><mi></mi></math>")).toBeNull();
  });
});
