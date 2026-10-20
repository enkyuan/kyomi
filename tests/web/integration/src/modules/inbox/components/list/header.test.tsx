import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { FilterControl, SortButton } from "@modules/inbox/components/list/header";

describe("SortButton", () => {
  test("uses Latest as the visible label and canonical sort token", async () => {
    const onSortChange = vi.fn();

    render(<SortButton sort="latest" onSortChange={onSortChange} />);

    const trigger = screen.getByRole("button", { name: "Sort" });
    expect(trigger.textContent).toContain("Latest");
    expect(screen.queryByText("Newest")).toBeNull();

    fireEvent.click(trigger);
    const latest = await screen.findByRole("menuitemradio", { name: "Latest" });
    expect(latest.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Oldest" }));

    expect(onSortChange).toHaveBeenCalledWith("oldest");
  });
});

describe("FilterControl", () => {
  test("renders pinned folders in the All dropdown and selects a folder", () => {
    const onFilterChange = vi.fn();
    const onFolderFilterChange = vi.fn();

    render(
      <FilterControl
        filter="all"
        pinnedFolders={[
          {
            id: "folder-1",
            name: "Programming",
            isPinned: true,
            pinnedAt: "2026-07-01T02:00:00.000Z",
          },
        ]}
        onFilterChange={onFilterChange}
        onFolderFilterChange={onFolderFilterChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose filter" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Programming" }));

    expect(onFolderFilterChange).toHaveBeenCalledWith("folder-1");
    expect(onFilterChange).not.toHaveBeenCalledWith("all");
  });

  test("constrains long pinned folder labels in the dropdown", () => {
    render(
      <FilterControl
        filter="all"
        pinnedFolders={[
          {
            id: "folder-1",
            name: "Programming With An Extremely Long Folder Name",
            isPinned: true,
            pinnedAt: "2026-07-01T02:00:00.000Z",
          },
        ]}
        onFilterChange={vi.fn()}
        onFolderFilterChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose filter" }));

    expect(screen.getByText("Programming With An Extremely Long Folder Name").className).toContain(
      "truncate",
    );
    expect(screen.getByText("Programming With An Extremely Long Folder Name").className).toContain(
      "max-w-32",
    );
  });

  test("keeps the button focus ring and coarse-pointer hit area on the filter trigger", () => {
    render(
      <FilterControl
        filter="all"
        pinnedFolders={[]}
        onFilterChange={vi.fn()}
        onFolderFilterChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Choose filter" });
    expect(trigger.className).toContain("focus-visible:ring-2");
    expect(trigger.className).toContain("pointer-coarse:after:min-h-11");
  });

  test("keeps My Feed and the All button group as tabs", () => {
    const onFilterChange = vi.fn();

    render(<FilterControl filter="my-feed" pinnedFolders={[]} onFilterChange={onFilterChange} />);

    const myFeed = screen.getByRole("tab", { name: "My Feed" });
    const all = screen.getByRole("tab", { name: /^All/ });
    expect(myFeed.getAttribute("aria-selected")).toBe("true");
    expect(all.getAttribute("aria-selected")).toBe("false");
    expect(all.querySelector('[data-slot="button"]')).toBeTruthy();

    fireEvent.click(all);

    expect(onFilterChange).toHaveBeenCalledWith("all");
  });

  test("labels an active pinned folder", () => {
    render(
      <FilterControl
        activeFolderId="folder-1"
        filter="all"
        pinnedFolders={[
          {
            id: "folder-1",
            name: "Programming",
            isPinned: true,
            pinnedAt: "2026-07-01T02:00:00.000Z",
          },
        ]}
        onFilterChange={vi.fn()}
        onFolderFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Programming")).toBeTruthy();
  });

  test("scrolls the All dropdown after four visible options", async () => {
    render(
      <FilterControl
        filter="all"
        pinnedFolders={Array.from({ length: 5 }, (_, index) => ({
          id: `folder-${index + 1}`,
          name: `Folder ${index + 1}`,
          isPinned: true,
          pinnedAt: "2026-07-01T02:00:00.000Z",
        }))}
        onFilterChange={vi.fn()}
        onFolderFilterChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose filter" }));

    await waitFor(() => {
      const menuPopup = document.querySelector('[data-slot="menu-popup"]');
      const menuContent = document.querySelector('[data-slot="menu-popup-content"]');

      expect(menuPopup?.className).not.toMatch(/(^|\s)p-1(\s|$)/);
      expect(menuContent).toBeTruthy();
      expect(menuPopup?.getAttribute("data-menu-shape")).toBe("pill");
      expect(menuPopup?.getAttribute("data-menu-size")).toBe("lg");
      expect(menuContent?.className).toContain(
        "max-h-[min(calc(var(--menu-item-height)*var(--menu-max-items)",
      );
      expect((menuContent as HTMLElement | null)?.style.getPropertyValue("--menu-max-items")).toBe(
        "4",
      );
      expect(menuContent?.className).not.toContain("overflow-y-auto");
      expect(menuContent?.querySelector('[data-slot="scroll-area-viewport"]')).toBeTruthy();
    });
  });
});
