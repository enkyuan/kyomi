// Value: protects=useSquircle clips to the measured size once, skips identical resize callbacks, and re-measures when the corner radius changes;
//   fails_when=the lastSize guard is removed (every observer callback re-renders) or not reset on radius change (stale clip-path);
//   why_new=only the first measurement was covered, and the hook now runs once per inbox row;
//   seam=none; no_claim=real layout (offset sizes and ResizeObserver are stubbed).
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSquircle } from "@kyomi/ui/lib/squircle";

let observerCallback: (() => void) | undefined;
let size = { width: 100, height: 40 };
let renders = 0;

function Probe({ radius }: { radius: number }) {
  const squircle = useSquircle<HTMLDivElement>(radius, 0.6);
  renders += 1;
  return <div ref={squircle.ref} data-testid="surface" style={squircle.style} />;
}

beforeEach(() => {
  renders = 0;
  size = { width: 100, height: 40 };
  observerCallback = undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(() => size.width);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => size.height);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useSquircle", () => {
  test("skips an observer callback that reports the same size", () => {
    render(<Probe radius={20} />);
    const afterMeasure = renders;

    act(() => observerCallback?.());

    expect(renders).toBe(afterMeasure);
  });

  test("clips again when the size changes", () => {
    const { getByTestId } = render(<Probe radius={20} />);
    const first = getByTestId("surface").style.clipPath;
    expect(first).toContain("path(");

    size = { width: 160, height: 40 };
    act(() => observerCallback?.());

    expect(getByTestId("surface").style.clipPath).not.toBe(first);
  });

  test("re-measures at the same size when the corner radius changes", () => {
    const { getByTestId, rerender } = render(<Probe radius={20} />);
    const first = getByTestId("surface").style.clipPath;

    rerender(<Probe radius={8} />);

    expect(getByTestId("surface").style.clipPath).not.toBe(first);
  });
});
