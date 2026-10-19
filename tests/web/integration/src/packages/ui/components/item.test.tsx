// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTarget,
  ItemTitle,
} from "@kyomi/ui/components/item";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Row({ onOpen, onMore }: { onOpen: () => void; onMore: () => void }) {
  return (
    <Item size="sm">
      <ItemTarget render={<button type="button" onClick={onOpen} />}>
        <ItemMedia>
          <span aria-hidden>📁</span>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Design</ItemTitle>
          <ItemDescription>12 feeds</ItemDescription>
        </ItemContent>
      </ItemTarget>
      <ItemActions reveal>
        <button type="button" onClick={onMore}>
          More
        </button>
      </ItemActions>
    </Item>
  );
}

describe("Item", () => {
  test("names the target from its title and description and keeps actions separate", () => {
    const onOpen = vi.fn();
    const onMore = vi.fn();
    render(<Row onMore={onMore} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: /Design\s*12 feeds/ }));
    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  test("stretches the target over the row and lifts actions above it", () => {
    const { container } = render(<Row onMore={vi.fn()} onOpen={vi.fn()} />);

    const target = container.querySelector<HTMLElement>("[data-slot=item-target]");
    const actions = container.querySelector<HTMLElement>("[data-slot=item-actions]");
    expect(target?.className).toContain("after:absolute");
    expect(target?.className).toContain("after:inset-0");
    expect(actions?.className).toContain("relative");
    expect(actions?.className).toContain("z-1");
    expect(actions?.className).toContain("group-hover/item:opacity-100");
  });

  test("keeps media and focus targets concentric with the row radius", () => {
    const { container } = render(<Row onMore={vi.fn()} onOpen={vi.fn()} />);

    const concentric = "rounded-[calc(var(--item-radius)-var(--item-padding))]";
    expect(container.querySelector("[data-slot=item-media]")?.className).toContain(concentric);
    expect(container.querySelector("[data-slot=item-target]")?.className).toContain(concentric);
  });

  test("marks size and selection for styling", () => {
    const { container, rerender } = render(<Item size="sm">Row</Item>);
    const row = () => container.querySelector<HTMLElement>("[data-slot=item]");

    expect(row()?.dataset.itemSize).toBe("sm");
    expect(row()?.hasAttribute("data-selected")).toBe(false);

    rerender(<Item selected>Row</Item>);
    expect(row()?.dataset.itemSize).toBe("default");
    expect(row()?.hasAttribute("data-selected")).toBe(true);
  });

  test("draws squircle rows with a clip path instead of a border radius class", () => {
    const { container } = render(<Item shape="squircle">Row</Item>);
    const row = container.querySelector<HTMLElement>("[data-slot=item]");

    expect(row?.className).not.toContain("rounded-(--item-radius)");
    expect(row?.style.borderRadius).toBe("16px");
  });
});
