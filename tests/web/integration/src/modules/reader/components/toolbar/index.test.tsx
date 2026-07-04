import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Toolbar } from "@modules/reader/components/toolbar";
import type { ToolbarProps } from "@modules/toolbar/lib/types";

vi.mock("@kyomi/ui/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));

function toolbarProps(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
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
    ...overrides,
  };
}

describe("reader toolbar", () => {
  test("passes the tooltip side through to read later toasts", () => {
    const onToggleSaved = vi.fn();
    render(
      <Toolbar
        {...toolbarProps({
          onToggleSaved,
          readerFocusMode: true,
          tooltipSide: "bottom",
        })}
      />,
    );

    const button = screen.getByRole("button", { name: "Read later" });
    fireEvent.click(button);

    expect(onToggleSaved).toHaveBeenCalledWith({
      anchor: button,
      side: "bottom",
      sideOffset: 8,
    });
  });
});
