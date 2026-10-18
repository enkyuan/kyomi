import { describe, expect, test } from "vitest";
import { badgeVariants } from "@kyomi/ui/components/badge";

describe("Badge", () => {
  test("tints the mizu variant like the other status badges", () => {
    const classes = badgeVariants({ variant: "mizu" });

    expect(classes).toContain("bg-mizu/8");
    expect(classes).toContain("text-mizu-foreground");
    expect(classes).toContain("dark:bg-mizu/16");
  });
});
