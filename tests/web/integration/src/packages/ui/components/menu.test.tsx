// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  menuPopupVariants,
} from "@kyomi/ui/components/menu";

describe("MenuPopup geometry", () => {
  test("derives a concentric radius from the item height for pill menus", () => {
    const pill = menuPopupVariants({ shape: "pill", size: "lg" });

    expect(pill).toContain("[--menu-item-height:--spacing(9)]");
    expect(pill).toContain("[--menu-item-radius:calc(var(--menu-item-height)/2)]");
    expect(pill).toContain("[--menu-radius:calc(var(--menu-item-height)/2+--spacing(1)+1px)]");
  });

  test("keeps the default menu at the coss radii and responsive item height", () => {
    const classes = menuPopupVariants({});

    expect(classes).toContain("[--menu-item-radius:var(--radius-sm)]");
    expect(classes).toContain("[--menu-radius:var(--radius-lg)]");
    expect(classes).toContain("sm:[--menu-item-height:--spacing(7)]");
  });

  test("caps visible rows and clips the popup when maxVisibleItems is set", () => {
    render(
      <Menu defaultOpen>
        <MenuTrigger>Open</MenuTrigger>
        <MenuPopup maxVisibleItems={3} shape="pill" size="lg">
          {["One", "Two", "Three", "Four"].map((label) => (
            <MenuItem key={label}>{label}</MenuItem>
          ))}
        </MenuPopup>
      </Menu>,
    );

    const popup = document.querySelector<HTMLElement>("[data-slot=menu-popup]");
    const content = document.querySelector<HTMLElement>("[data-slot=menu-popup-content]");
    expect(popup?.dataset.menuShape).toBe("pill");
    expect(popup?.dataset.menuSize).toBe("lg");
    expect(popup?.className).toContain("overflow-hidden");
    expect(content?.style.getPropertyValue("--menu-max-items")).toBe("3");
    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
  });
});

describe("MenuRadioItem", () => {
  test("exposes single choice with aria-checked, with or without a check mark", () => {
    const onValueChange = vi.fn();
    render(
      <Menu defaultOpen>
        <MenuTrigger>Sort</MenuTrigger>
        <MenuPopup>
          <MenuRadioGroup value="latest" onValueChange={onValueChange}>
            <MenuRadioItem value="latest">Latest</MenuRadioItem>
            <MenuRadioItem indicator="none" value="oldest">
              Oldest
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>,
    );

    const latest = screen.getByRole("menuitemradio", { name: "Latest" });
    const oldest = screen.getByRole("menuitemradio", { name: "Oldest" });
    expect(latest.getAttribute("aria-checked")).toBe("true");
    expect(oldest.dataset.indicator).toBe("none");
    expect(oldest.querySelector("svg")).toBeNull();

    fireEvent.click(oldest);
    expect(onValueChange).toHaveBeenCalledWith("oldest", expect.anything());
  });
});
