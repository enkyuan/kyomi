import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useRecapRailVisibility } from "@modules/inbox/hooks/use-layout";

const mocks = vi.hoisted(() => ({
  useMediaQuery: vi.fn(),
}));

vi.mock("@kyomi/ui/hooks/use-media-query", () => ({
  useMediaQuery: mocks.useMediaQuery,
}));

beforeEach(() => {
  mocks.useMediaQuery.mockReset();
});

describe("useRecapRailVisibility", () => {
  test("hides when the viewport itself is below the xl breakpoint", () => {
    mocks.useMediaQuery.mockReturnValue(false);

    const { result } = renderHook(() => useRecapRailVisibility(0));

    expect(result.current).toBe(false);
  });

  test("shows once the viewport is xl+ and no container measurement exists yet", () => {
    // Before the ResizeObserver-backed measurement resolves, contentWidthPx is 0 — this must not
    // be treated as "too tight", or the rail would flash hidden on every load.
    mocks.useMediaQuery.mockReturnValue(true);

    const { result } = renderHook(() => useRecapRailVisibility(0));

    expect(result.current).toBe(true);
  });

  test("hides when the measured content column is too narrow even though the viewport is xl+", () => {
    // e.g. a maximized-but-narrow split-screen browser window on a wide monitor.
    mocks.useMediaQuery.mockReturnValue(true);

    const { result } = renderHook(() => useRecapRailVisibility(1000));

    expect(result.current).toBe(false);
  });

  test("shows once the measured content column is wide enough", () => {
    mocks.useMediaQuery.mockReturnValue(true);

    const { result } = renderHook(() => useRecapRailVisibility(1400));

    expect(result.current).toBe(true);
  });
});
