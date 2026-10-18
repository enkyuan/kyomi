// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  Button,
  ButtonGroup,
  ButtonLabel,
  buttonGroupVariants,
  buttonVariants,
} from "@kyomi/ui/components/button";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("Button", () => {
  test("gives every pressable button motion-safe press feedback", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });

    expect(button.className).toContain("motion-safe:active:scale-96");
    expect(button.className).toContain("transition-[box-shadow,scale]");
  });

  test("lets static and link buttons opt out of the press scale", () => {
    render(
      <>
        <Button static>Static</Button>
        <Button variant="link">Link</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Static" }).className).not.toContain("scale-96");
    expect(screen.getByRole("button", { name: "Link" }).className).not.toContain("scale-96");
  });

  test("keeps the inner highlight concentric for pill buttons of every size", () => {
    const classes = buttonVariants({ shape: "pill", size: "xs" });

    expect(classes).toContain("rounded-full");
    expect(classes).toContain("before:rounded-full");
  });

  test("lets an icon opt out of the optical negative margin with its own mx class", () => {
    const classes = buttonVariants();

    expect(classes).toContain("[&_svg:not([class*='mx-'])]:-mx-0.5");
    expect(classes).not.toContain("[&_svg]:-mx-0.5");
  });

  test("offers muted and soft variants for quiet and tinted actions", () => {
    expect(buttonVariants({ variant: "ghost-muted" })).toContain("text-muted-foreground");
    expect(buttonVariants({ variant: "ghost-muted" })).toContain("hover:text-foreground");
    expect(buttonVariants({ variant: "soft" })).toContain("bg-primary/14");
  });
});

describe("ButtonGroup", () => {
  test("exposes its buttons as one labelled group", () => {
    render(
      <ButtonGroup aria-label="Theme and language" variant="split">
        <Button variant="secondary">Dark</Button>
        <Button variant="secondary">中文</Button>
      </ButtonGroup>,
    );

    const group = screen.getByRole("group", { name: "Theme and language" });
    expect(group.dataset.slot).toBe("button-group");
    expect(group.dataset.variant).toBe("split");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  test("splits segments with capsule ends and small inner corners", () => {
    const classes = buttonGroupVariants({ variant: "split" });

    expect(classes).toContain("gap-0.75");
    expect(classes).toContain("*:data-[slot=button]:rounded-sm");
    expect(classes).toContain("*:data-[slot=button]:first:rounded-s-full");
    expect(classes).toContain("*:data-[slot=button]:last:rounded-e-full");
  });

  test("joins segments by default, matching the attached group", () => {
    render(
      <ButtonGroup aria-label="Zoom">
        <Button variant="outline">−</Button>
        <Button variant="outline">+</Button>
      </ButtonGroup>,
    );

    expect(screen.getByRole("group", { name: "Zoom" }).dataset.variant).toBe("attached");
  });
});

describe("ButtonLabel", () => {
  const animate = vi.fn(() => ({ cancel: vi.fn(), finished: new Promise(() => {}) }));

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    Element.prototype.animate = animate as unknown as Element["animate"];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    animate.mockClear();
  });

  test("crossfades the previous label out without exposing it to assistive technology", () => {
    stubReducedMotion(false);
    const { rerender } = render(
      <Button>
        <ButtonLabel>Dark</ButtonLabel>
      </Button>,
    );

    expect(animate).not.toHaveBeenCalled();

    rerender(
      <Button>
        <ButtonLabel>Light</ButtonLabel>
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Light" })).toBeTruthy();
    const ghost = screen.getByText("Dark");
    expect(ghost.closest("[aria-hidden]")).not.toBeNull();
    expect(animate).toHaveBeenCalled();
  });

  test("swaps instantly when the user prefers reduced motion", () => {
    stubReducedMotion(true);
    const { rerender } = render(<ButtonLabel>Dark</ButtonLabel>);

    rerender(<ButtonLabel>Light</ButtonLabel>);

    expect(screen.queryByText("Dark")).toBeNull();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(animate).not.toHaveBeenCalled();
  });
});
