import { Separator } from "@kyomi/ui/components/separator";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

test("keeps Base UI orientation and resolves caller styles from component state", () => {
  render(
    <Separator
      className={({ orientation }) => (orientation === "vertical" ? "bg-input" : "bg-card")}
      orientation="vertical"
    />,
  );

  const separator = screen.getByRole("separator");
  expect(separator.getAttribute("aria-orientation")).toBe("vertical");
  expect(separator.getAttribute("data-orientation")).toBe("vertical");
  expect(separator.classList.contains("bg-input")).toBe(true);
  expect(separator.classList.contains("data-[orientation=vertical]:w-(--stroke-width)")).toBe(true);
});
