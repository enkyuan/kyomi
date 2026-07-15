import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ReaderToolbar } from "@modules/inbox/components/page/article/toolbar";
import type { ToolbarModel, ToolbarProps } from "@modules/toolbar/lib/types";

vi.mock("@kyomi/ui/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@kyomi/ui/motion", async (importOriginal) => {
  const motion = await importOriginal<typeof import("@kyomi/ui/motion")>();

  return {
    ...motion,
    useReducedMotion: () => true,
  };
});

const TOOLTIP_COLLISION_AVOIDANCE = {
  side: "shift",
  align: "shift",
  fallbackAxisSide: "none",
} as const;

function toolbarProps(): ToolbarProps {
  return {
    activeMode: "extracted",
    canDecreaseFont: true,
    canIncreaseFont: true,
    contentWidth: "wide",
    extractedAvailable: true,
    fontSizePx: 17,
    isSaved: false,
    onCycleContentWidth: vi.fn(),
    onDecreaseFontSize: vi.fn(),
    onIncreaseFontSize: vi.fn(),
    onOpenAi: vi.fn(),
    onOpenOriginal: vi.fn(),
    onShareArticle: vi.fn(),
    onToggleMode: vi.fn(),
    onToggleSaved: vi.fn(),
    onTranslateArticle: vi.fn(),
    readerFocusMode: true,
  };
}

function renderToolbar(collapsed: boolean) {
  render(
    <ReaderToolbar
      collapsed={collapsed}
      toolbar={{ toolbarProps: toolbarProps() } as ToolbarModel}
      tooltipCollisionAvoidance={TOOLTIP_COLLISION_AVOIDANCE}
      tooltipSide="bottom"
    />,
  );

  const toolbar = screen.getByRole("toolbar", { name: "Reader tools" });
  const shell = toolbar.parentElement;
  expect(shell).not.toBeNull();

  return shell as HTMLDivElement;
}

describe("article reader toolbar", () => {
  test.each([
    [false, "13.3125rem"],
    [true, "5.25rem"],
  ])("keeps %s state edge controls concentric", async (collapsed, expectedWidth) => {
    const shell = renderToolbar(collapsed);

    expect(shell.className).toMatch(/(?:^|\s)h-11(?:\s|$)/);
    expect(shell.className).toMatch(/(?:^|\s)p-1(?:\s|$)/);
    expect(shell.className).not.toContain("px-1.5");
    expect(screen.getByRole("button", { name: "Read later" }).className).toContain("size-9");
    await waitFor(() => expect(shell.style.width).toBe(expectedWidth));
  });
});
