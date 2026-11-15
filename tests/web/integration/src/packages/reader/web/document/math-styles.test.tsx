// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RenderDocument } from "@kyomi/reader/web";
import { documentOf, text } from "./fixtures";

const katexCss = vi.hoisted(() => vi.fn());

// The stylesheet itself is a no-op under Vitest, so observe the lazy module that imports it.
vi.mock("../../../../../../../../packages/reader/src/web/katex-styles", () => {
  katexCss();
  return {};
});

describe("KaTeX stylesheet", () => {
  test("is not loaded for a document without math", async () => {
    render(
      <RenderDocument
        document={documentOf([{ type: "paragraph", children: [text("No math")] }])}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(katexCss).not.toHaveBeenCalled();
  });

  test("loads when features.math is set", async () => {
    render(
      <RenderDocument
        document={documentOf(
          [{ type: "math", tex: "x", rendered: '<span class="katex">x</span>' }],
          {
            features: { math: true },
          },
        )}
      />,
    );
    await waitFor(() => expect(katexCss).toHaveBeenCalledTimes(1));
  });
});
