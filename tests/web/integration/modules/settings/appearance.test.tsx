// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AppearancePagePanel } from "@modules/settings";

const setInboxPreferencesMock = vi.fn();
const resetInboxPreferencesMock = vi.fn();

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

vi.mock("@modules/inbox/hooks/use-inbox-data", () => ({
  useInboxPreferences: () => ({
    limits: { minFontSizePx: 14, maxFontSizePx: 20 },
    defaults: {
      inboxDefaultView: "today",
      inboxDensity: "comfortable",
      articleOpenBehavior: "split",
      inboxMarkReadBehavior: "on-open",
      inboxTimestampDisplay: "relative",
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
      inboxTimestampDisplay: "relative",
      inboxTimestampHourCycle: "12h",
      inboxFontSizePx: 16,
      inboxShowRecents: false,
      inboxShowFavicons: true,
    },
    resetPreferences: resetInboxPreferencesMock,
    setPreferences: setInboxPreferencesMock,
  }),
}));

vi.mock("@kyomi/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@kyomi/ui/sidebar", () => ({
  SidebarMenuButton: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@kyomi/ui/select", () => ({
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

vi.mock("@kyomi/ui/switch", () => ({
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

vi.mock("@kyomi/ui/slider", () => ({
  SliderComfortable: ({ onChange }: { onChange?: (value: number) => void }) => (
    <button onClick={() => onChange?.(21)} type="button">
      font-size-slider
    </button>
  ),
}));

vi.mock("@kyomi/ui/group", () => ({
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
  });

  test("updates inbox default view preferences from the merged page", () => {
    render(<AppearancePagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "All unread" }));

    expect(setInboxPreferencesMock).toHaveBeenCalledWith({ inboxDefaultView: "unread" });
  });

  test("resets inbox defaults from the merged page", () => {
    render(<AppearancePagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));

    expect(resetInboxPreferencesMock).toHaveBeenCalled();
  });
});
