// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InboxPagePanel } from "@modules/settings/inbox";

const setPreferencesMock = vi.fn();
const resetPreferencesMock = vi.fn();

vi.mock("@lib/inbox-preferences", () => ({
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
    resetPreferences: resetPreferencesMock,
    setPreferences: setPreferencesMock,
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

vi.mock("@components/ui/slider", () => ({
  SliderComfortable: () => <div>slider</div>,
}));

describe("InboxPagePanel", () => {
  beforeEach(() => {
    setPreferencesMock.mockReset();
    resetPreferencesMock.mockReset();
  });

  test("updates the default inbox view preference", () => {
    render(<InboxPagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "All unread" }));

    expect(setPreferencesMock).toHaveBeenCalledWith({ inboxDefaultView: "unread" });
  });

  test("toggles the recents tab preference", () => {
    render(<InboxPagePanel />);

    fireEvent.click(screen.getByRole("button", { name: /show recents tab/i }));

    expect(setPreferencesMock).toHaveBeenCalledWith({ inboxShowRecents: true });
  });

  test("resets inbox defaults", () => {
    render(<InboxPagePanel />);

    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));

    expect(resetPreferencesMock).toHaveBeenCalled();
  });

  test("toggles the favicon preference", () => {
    render(<InboxPagePanel />);

    fireEvent.click(screen.getByRole("button", { name: /show favicons/i }));

    expect(setPreferencesMock).toHaveBeenCalledWith({ inboxShowFavicons: false });
  });
});
