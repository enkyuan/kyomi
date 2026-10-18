// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Scrubber, useScrubberScroll } from "@kyomi/ui/components/scrubber";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const label = (index: number) => `Check-in ${index + 1}`;

describe("Scrubber", () => {
  test("is a labelled slider over item indices with readable value text", () => {
    render(<Scrubber aria-label="Timeline" count={20} defaultValue={5} getAriaValueText={label} />);

    const slider = screen.getByRole("slider", { name: "Timeline" });
    // Base UI renders a native range input, so min and max carry the implicit ARIA range.
    expect(slider.getAttribute("type")).toBe("range");
    expect(slider.getAttribute("min")).toBe("0");
    expect(slider.getAttribute("max")).toBe("19");
    expect(slider.getAttribute("aria-valuenow")).toBe("5");
    expect(slider.getAttribute("aria-valuetext")).toBe("Check-in 6");
  });

  test("steps by item with arrows, by large step with page keys, and jumps with Home/End", () => {
    const onValueChange = vi.fn();
    render(<Scrubber aria-label="Timeline" count={20} value={5} onValueChange={onValueChange} />);
    const slider = screen.getByRole("slider", { name: "Timeline" });

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "PageUp" });
    fireEvent.keyDown(slider, { key: "Home" });
    fireEvent.keyDown(slider, { key: "End" });

    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([6, 7, 0, 19]);
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("keyboard");
  });

  test("defaults to the newest item and draws one tick per item plus group separators", () => {
    const { container } = render(
      <Scrubber aria-label="Timeline" count={12} getAriaValueText={label} groups={[0, 4, 8]} />,
    );

    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("Check-in 12");
    expect(container.querySelectorAll("[data-slot=scrubber-tick]")).toHaveLength(12);
    // Index 0 starts the list, so only the boundaries at 4 and 8 draw a separator.
    expect(container.querySelectorAll("[data-slot=scrubber-separator]")).toHaveLength(2);
  });

  test("reports the item under the pointer and clears it when the pointer leaves", () => {
    const onPreviewChange = vi.fn();
    const { container } = render(
      <Scrubber aria-label="Timeline" count={11} onPreviewChange={onPreviewChange} />,
    );
    const control = container.querySelector<HTMLElement>("[data-slot=scrubber-control]");
    if (!control) throw new Error("missing control");
    control.getBoundingClientRect = () =>
      ({ left: 0, right: 100, top: 0, bottom: 44, width: 100, height: 44 }) as DOMRect;

    fireEvent.pointerMove(control, { clientX: 52 });
    // Still item 5, so it is not reported again.
    fireEvent.pointerMove(control, { clientX: 54 });
    fireEvent.pointerLeave(control);

    expect(onPreviewChange.mock.calls).toEqual([[5], [null]]);
  });

  test("keeps a 44px control when there are too few items to fill it", () => {
    const { container } = render(<Scrubber aria-label="Timeline" count={1} />);
    const control = container.querySelector<HTMLElement>("[data-slot=scrubber-control]");

    expect(control?.style.maxWidth).toBe("44px");
    expect(container.querySelectorAll("[data-slot=scrubber-tick]")).toHaveLength(1);
  });

  test("disables the slider when disabled", () => {
    render(<Scrubber aria-label="Timeline" count={5} disabled />);

    expect(screen.getByRole("slider", { name: "Timeline" })).toHaveProperty("disabled", true);
  });
});

describe("useScrubberScroll", () => {
  let frames: FrameRequestCallback[] = [];
  const flush = () =>
    act(() => {
      const pending = frames;
      frames = [];
      for (const callback of pending) callback(0);
    });

  beforeEach(() => {
    frames = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
    );
  });

  function createScroller(itemWidth: number, count: number) {
    const scroller = document.createElement("div");
    Object.defineProperty(scroller, "clientWidth", { value: itemWidth * 3 });
    scroller.getBoundingClientRect = () => ({ left: 0 }) as DOMRect;
    scroller.scrollTo = vi.fn() as unknown as HTMLElement["scrollTo"];
    for (let index = 0; index < count; index++) {
      const item = document.createElement("figure");
      item.dataset.scrubberItem = "";
      item.getBoundingClientRect = () =>
        ({
          left: index * itemWidth - scroller.scrollLeft,
          right: (index + 1) * itemWidth - scroller.scrollLeft,
        }) as DOMRect;
      scroller.append(item);
    }
    document.body.append(scroller);
    const ref = createRef<HTMLElement>();
    Object.assign(ref, { current: scroller });
    return { scroller, ref };
  }

  test("reads the centred item and the visible range from the scroll position", () => {
    const { scroller, ref } = createScroller(100, 10);
    scroller.scrollLeft = 200;

    const { result } = renderHook(() => useScrubberScroll(ref));
    flush();

    expect(result.current.count).toBe(10);
    expect(result.current.value).toBe(3);
    expect(result.current.range[0]).toBeCloseTo(1.5);
    expect(result.current.range[1]).toBeCloseTo(4.5);
    scroller.remove();
  });

  test("treats a right edge past the last item as the end of the list", () => {
    const { scroller, ref } = createScroller(100, 10);
    // Trailing padding lets the viewport extend beyond the last item's right edge (1000px).
    scroller.scrollLeft = 850;

    const { result } = renderHook(() => useScrubberScroll(ref));
    flush();

    expect(result.current.range[0]).toBeCloseTo(8);
    expect(result.current.range[1]).toBeCloseTo(9.5);
    expect(result.current.value).toBe(9);
    scroller.remove();
  });

  test("glides to an item and holds that destination until the scroll settles", () => {
    const { scroller, ref } = createScroller(100, 10);
    const { result } = renderHook(() => useScrubberScroll(ref));
    flush();

    act(() => result.current.onValueChange(6));
    expect(scroller.scrollTo).toHaveBeenCalledWith({ behavior: "smooth", left: 500 });
    expect(result.current.value).toBe(6);

    // Mid-glide the centre passes item 4, but the announced value stays on the destination.
    scroller.scrollLeft = 300;
    scroller.dispatchEvent(new Event("scroll"));
    flush();
    expect(result.current.value).toBe(6);
    expect(result.current.range[0]).toBeCloseTo(2.5);

    // If the glide stops short, scrollend releases the hold and the real position wins.
    scroller.dispatchEvent(new Event("scrollend"));
    flush();
    expect(result.current.value).toBe(4);
    scroller.remove();
  });

  test("jumps without smoothing while dragging", () => {
    const { scroller, ref } = createScroller(100, 10);
    const { result } = renderHook(() => useScrubberScroll(ref));
    flush();

    act(() =>
      result.current.onValueChange(2, { reason: "drag" } as Parameters<
        typeof result.current.onValueChange
      >[1]),
    );

    expect(scroller.scrollTo).toHaveBeenCalledWith({ behavior: "instant", left: 100 });
    scroller.remove();
  });
});
