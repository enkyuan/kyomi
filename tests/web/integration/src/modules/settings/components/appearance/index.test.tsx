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
      inboxDefaultView: "my-feed",
      inboxDensity: "comfortable",
      articleOpenBehavior: "split",
      inboxMarkReadBehavior: "on-open",
      inboxTimestampDisplay: "relative",
      inboxTimestampHourCycle: "12h",
      inboxFontSizePx: 16,
      inboxShowFavicons: true,
    },
    preferences: {
      inboxDefaultView: "my-feed",
      inboxDensity: "comfortable",
      articleOpenBehavior: "split",
      inboxMarkReadBehavior: "on-open",
      inboxTimestampDisplay: "relative",
      inboxTimestampHourCycle: "12h",
      inboxFontSizePx: 16,
      inboxShowFavicons: true,
    },
    resetPreferences: resetInboxPreferencesMock,
    setPreferences: setInboxPreferencesMock,
  }),
}));

vi.mock("@kyomi/ui/atoms/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@kyomi/ui/atoms/sidebar", () => ({
  SidebarMenuButton: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@kyomi/ui/atoms/select", () => ({
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

vi.mock("@kyomi/ui/atoms/segmented-control", () => {
  let onSegmentedValueChange: ((value: string) => void) | undefined;

  return {
    SegmentedControl: ({
      children,
      onValueChange,
    }: {
      children: ReactNode;
      onValueChange?: (value: string) => void;
    }) => {
      onSegmentedValueChange = onValueChange;
      return <div>{children}</div>;
    },
    SegmentedControlList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SegmentedControlTab: ({ children, value }: { children: ReactNode; value: string }) => (
      <button onClick={() => onSegmentedValueChange?.(value)} type="button">
        {children}
      </button>
    ),
  };
});

vi.mock("@kyomi/ui/atoms/switch", () => ({
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

vi.mock("@kyomi/ui/atoms/slider", () => ({
  SliderComfortable: ({ onChange }: { onChange?: (value: number) => void }) => (
    <button onClick={() => onChange?.(21)} type="button">
      font-size-slider
    </button>
  ),
}));

vi.mock("@kyomi/ui/atoms/group", () => ({
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

  test("updates inbox text scale preferences from the merged page", () => {
    render(<AppearancePagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "xl" }));

    expect(setInboxPreferencesMock).toHaveBeenCalledWith({ inboxFontSizePx: 20 });
  });

  test("shows relative timestamp display as the default-first option", () => {
    render(<AppearancePagePanel />);

    const timestampOptions = screen
      .getAllByRole("button")
      .map((button) => button.textContent)
      .filter((label) => label === "Relative" || label === "Absolute");

    expect(timestampOptions).toEqual(["Relative", "Absolute"]);
  });

  test("resets inbox defaults from the merged page", () => {
    render(<AppearancePagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));

    expect(resetInboxPreferencesMock).toHaveBeenCalled();
  });
});
