// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  emptyVariants,
} from "@kyomi/ui/components/empty";

describe("Empty", () => {
  test.each([
    ["sm", "py-6"],
    ["md", "min-h-72"],
    ["default", "md:py-20"],
    ["page", "min-h-svh"],
  ] as const)("sizes the %s layout", (size, expected) => {
    expect(emptyVariants({ size })).toContain(expected);
  });

  test("scales the title and media spacing from the container size", () => {
    render(
      <Empty size="md">
        <EmptyHeader>
          <EmptyMedia variant="illustration">
            <svg aria-label="Inbox illustration" role="img" />
          </EmptyMedia>
          <EmptyTitle>Nothing here yet</EmptyTitle>
          <EmptyDescription>New stories appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>,
    );

    const title = screen.getByText("Nothing here yet");
    expect(title.closest("[data-empty-size]")?.getAttribute("data-empty-size")).toBe("md");
    expect(title.className).toContain("in-data-[empty-size=md]:text-base");
    expect(title.className).toContain("in-data-[empty-size=page]:text-2xl");
    expect(screen.getAllByRole("img", { name: "Inbox illustration" }).length).toBeGreaterThan(0);
  });
});
