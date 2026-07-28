// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  SidebarContext,
  SidebarMenuButton,
  type SidebarContextProps,
} from "@kyomi/ui/atoms/sidebar";

const sidebarContext: SidebarContextProps = {
  state: "expanded",
  open: true,
  setOpen: vi.fn(),
  openMobile: false,
  setOpenMobile: vi.fn(),
  isMobile: false,
  toggleSidebar: vi.fn(),
};

describe("SidebarMenuButton", () => {
  test("shows the pointer cursor for interactive buttons", () => {
    render(
      <SidebarContext.Provider value={sidebarContext}>
        <SidebarMenuButton>Add feed</SidebarMenuButton>
      </SidebarContext.Provider>,
    );

    expect(screen.getByRole("button", { name: "Add feed" }).classList).toContain("cursor-pointer");
  });
});
