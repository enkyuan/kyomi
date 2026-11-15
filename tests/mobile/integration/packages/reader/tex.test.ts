import { describe, expect, test } from "bun:test";
import {
  layoutMathSvg,
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

  test("converts ex to points, reads descent, and applies the colour", () => {
    const layout = layoutMathSvg(svg, 20, "#112233");
    expect(layout?.width).toBeCloseTo(88);
    expect(layout?.height).toBeCloseTo(26.4);
    expect(layout?.descent).toBeCloseTo(8.8);
    expect(layout?.xml).not.toContain("currentColor");
    expect(layout?.xml).toContain("#112233");
  });

  test("returns null without readable sizes and ignores hostile colours", () => {
    expect(layoutMathSvg("<svg></svg>", 16, "#000")).toBeNull();
    expect(layoutMathSvg(svg, 16, '"><script>')?.xml).not.toContain("script");
  });
});
