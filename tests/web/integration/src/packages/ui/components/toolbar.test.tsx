// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Toolbar, ToolbarSeparator, toolbarVariants } from "@kyomi/ui/components/toolbar";

describe("Toolbar", () => {
  test("offers surface, ghost, and pill variants", () => {
    expect(toolbarVariants({ variant: "default" })).toContain("bg-card");
    expect(toolbarVariants({ variant: "ghost" })).not.toContain("bg-");
    expect(toolbarVariants({ variant: "pill" })).toContain("bg-muted-solid");
    expect(toolbarVariants({ variant: "pill" })).toContain("rounded-full");
  });

  test("renders a labelled toolbar with an inset separator", () => {
    render(
      <Toolbar aria-label="Reader tools" variant="pill">
        <ToolbarSeparator inset orientation="vertical" />
      </Toolbar>,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Reader tools" });
    expect(toolbar.dataset.variant).toBe("pill");
    expect(screen.getByRole("separator").className).toContain("bg-border/70");
  });
});
