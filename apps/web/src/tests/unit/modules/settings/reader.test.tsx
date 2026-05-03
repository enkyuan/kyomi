// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ReaderPagePanel } from "@modules/settings/reader";

const setPreferencesMock = vi.fn();
const resetPreferencesMock = vi.fn();

vi.mock("@lib/reader-preferences", () => ({
  useReaderPreferences: () => ({
    limits: { minFontSizePx: 14, maxFontSizePx: 22 },
    preferences: {
      defaultMode: "smart",
      fontSizePx: 17,
      contentWidth: "medium",
      openLinksInNewTab: true,
      showLinkPreviews: true,
      showImages: true,
    },
    setPreferences: setPreferencesMock,
    resetPreferences: resetPreferencesMock,
  }),
}));

vi.mock("@components/ui/slider", () => ({
  SliderComfortable: ({ onChange }: { onChange: (value: number) => void }) => (
    <button onClick={() => onChange(21)} type="button">
      font-size-slider
    </button>
  ),
}));

vi.mock("@components/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@components/ui/sidebar", () => ({
  SidebarMenuButton: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button onClick={() => onCheckedChange?.(!checked)} type="button">
      toggle
    </button>
  ),
}));

vi.mock("@components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectPopup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));

describe("ReaderPagePanel", () => {
  beforeEach(() => {
    setPreferencesMock.mockReset();
    resetPreferencesMock.mockReset();
  });

  test("maps slider changes directly to reader font size preferences", () => {
    render(<ReaderPagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "font-size-slider" }));

    expect(setPreferencesMock).toHaveBeenCalledWith({ fontSizePx: 21 });
  });

  test("toggles reader link previews", () => {
    render(<ReaderPagePanel />);

    fireEvent.click(screen.getByRole("button", { name: /link previews on hover/i }));

    expect(setPreferencesMock).toHaveBeenCalledWith({ showLinkPreviews: false });
  });
});
