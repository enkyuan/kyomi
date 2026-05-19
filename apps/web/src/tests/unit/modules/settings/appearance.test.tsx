// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AppearancePagePanel } from "@modules/settings";

const setInboxPreferencesMock = vi.fn();
const resetInboxPreferencesMock = vi.fn();
const setReaderPreferencesMock = vi.fn();
const resetReaderPreferencesMock = vi.fn();

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("@modules/inbox", () => ({
  useInboxPreferences: () => ({
    limits: { minFontSizePx: 14, maxFontSizePx: 20 },
    defaults: {
      inboxDefaultView: "today",
      inboxDensity: "comfortable",
      articleOpenBehavior: "split",
      inboxMarkReadBehavior: "on-open",
      inboxTimestampDisplay: "absolute",
      inboxTimestampHourCycle: "12h",
      inboxFontSizePx: 16,
      inboxShowRecents: false,
      inboxShowFavicons: true,
    },
    preferences: {
      inboxDefaultView: "today",
      inboxDensity: "comfortable",
      articleOpenBehavior: "split",
      inboxMarkReadBehavior: "on-open",
      inboxTimestampDisplay: "absolute",
      inboxTimestampHourCycle: "12h",
      inboxFontSizePx: 16,
      inboxShowRecents: false,
      inboxShowFavicons: true,
    },
    resetPreferences: resetInboxPreferencesMock,
    setPreferences: setInboxPreferencesMock,
  }),
}));

vi.mock("@modules/reader", () => ({
  useReaderPreferences: () => ({
    limits: { minFontSizePx: 14, maxFontSizePx: 22 },
    defaults: {
      defaultMode: "smart",
      fontSizePx: 17,
      contentWidth: "wide",
      openLinksInNewTab: true,
      showLinkPreviews: true,
      showImages: true,
    },
    preferences: {
      defaultMode: "smart",
      fontSizePx: 17,
      contentWidth: "wide",
      openLinksInNewTab: true,
      showLinkPreviews: true,
      showImages: true,
    },
    setPreferences: setReaderPreferencesMock,
    resetPreferences: resetReaderPreferencesMock,
  }),
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

vi.mock("@components/ui/select", () => ({
  Select: ({
    children,
    items,
    onValueChange,
  }: {
    children: ReactNode;
    items?: Array<{ label: string; value: string }>;
    onValueChange?: (value: string) => void;
  }) => (
    <div>
      {children}
      {items?.map((item) => (
        <button key={item.value} onClick={() => onValueChange?.(item.value)} type="button">
          {item.label}
        </button>
      ))}
    </div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectPopup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));

vi.mock("@components/ui/switch", () => ({
  Switch: ({
    checked,
    id,
    onCheckedChange,
  }: {
    checked?: boolean;
    id?: string;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button aria-label={id} onClick={() => onCheckedChange?.(!checked)} type="button">
      toggle
    </button>
  ),
}));

vi.mock("@components/ui/slider", () => ({
  SliderComfortable: ({ onChange }: { onChange?: (value: number) => void }) => (
    <button onClick={() => onChange?.(21)} type="button">
      font-size-slider
    </button>
  ),
}));

vi.mock("@components/ui/group", () => ({
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  GroupSeparator: () => <div />,
}));

vi.mock("@modules/settings", async () => {
  const actual = await vi.importActual<typeof import("@modules/settings")>("@modules/settings");
  return {
    ...actual,
    ThemeSwitcher: () => <div>theme-switcher</div>,
  };
});

describe("AppearancePagePanel", () => {
  beforeEach(() => {
    setInboxPreferencesMock.mockReset();
    resetInboxPreferencesMock.mockReset();
    setReaderPreferencesMock.mockReset();
    resetReaderPreferencesMock.mockReset();
  });

  test("updates inbox default view preferences from the merged page", () => {
    render(<AppearancePagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "All unread" }));

    expect(setInboxPreferencesMock).toHaveBeenCalledWith({ inboxDefaultView: "unread" });
  });

  test("updates reader font size preferences from the merged page", () => {
    render(<AppearancePagePanel />);

    fireEvent.click(screen.getAllByRole("button", { name: "font-size-slider" })[1]!);

    expect(setReaderPreferencesMock).toHaveBeenCalledWith({ fontSizePx: 21 });
  });

  test("toggles reader link previews from the merged page", () => {
    render(<AppearancePagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "reader-link-previews" }));

    expect(setReaderPreferencesMock).toHaveBeenCalledWith({ showLinkPreviews: false });
  });

  test("resets inbox and reader defaults together", () => {
    render(<AppearancePagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));

    expect(resetInboxPreferencesMock).toHaveBeenCalled();
    expect(resetReaderPreferencesMock).toHaveBeenCalled();
  });
});
