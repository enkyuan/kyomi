import { describe, expect, test } from "vitest";
import { isSafeMathSvg } from "@kyomi/reader/document/math-svg";

const SVG = (attributes: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="2ex" height="1ex"${attributes}><path d="M0 0"/></svg>`;

describe("isSafeMathSvg", () => {
  test("accepts MathJax-shaped output", () => {
    expect(isSafeMathSvg(SVG(' viewBox="0 -1 2 3" style="vertical-align: -0.5ex;"'))).toBe(true);
  });

  test.each(["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__"])(
    "refuses a %s attribute without throwing",
    (name) => {
      expect(isSafeMathSvg(SVG(` ${name}="x"`))).toBe(false);
    },
  );

  test("still refuses handlers and unknown attributes", () => {
    expect(isSafeMathSvg(SVG(' onload="alert(1)"'))).toBe(false);
    expect(isSafeMathSvg(SVG(' href="https://evil.example"'))).toBe(false);
  });
});
