// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  RECAP_SUMMARY_LAYOUT_CLASS,
  RECAP_SUMMARY_SECTION_CLASS,
  RecapSkeleton,
} from "@modules/inbox/components/recap/sections";

describe("recap summary layout", () => {
  test("keeps loading and populated sections on one stable full-width contract", () => {
    const { container } = render(<RecapSkeleton />);
    const layout = container.firstElementChild;

    expect(layout?.className).toBe(RECAP_SUMMARY_LAYOUT_CLASS);
    expect(RECAP_SUMMARY_LAYOUT_CLASS).toContain("w-full");
    expect(RECAP_SUMMARY_LAYOUT_CLASS).toContain("grid-rows-3");
    expect(RECAP_SUMMARY_LAYOUT_CLASS).not.toContain("max-content");
    expect(RECAP_SUMMARY_SECTION_CLASS).toContain("w-full");
    expect(RECAP_SUMMARY_SECTION_CLASS).toContain("h-full");
    expect(RECAP_SUMMARY_SECTION_CLASS).toContain("[scrollbar-gutter:stable]");

    const sections = Array.from(layout?.children ?? []);
    expect(sections).toHaveLength(3);
    expect(sections.every((section) => section.className.includes("w-full"))).toBe(true);
    expect(new Set(sections.map((section) => section.className)).size).toBe(1);
  });
});
