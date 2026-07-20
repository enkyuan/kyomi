// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Dialog, DialogBackdrop, DialogPortal, DialogPrimitive } from "@kyomi/ui/dialog";
import {
  AnchoredToastProvider,
  ToastProvider,
  anchoredToastManager,
  toastManager,
} from "@kyomi/ui/toast";

afterEach(() => {
  act(() => {
    toastManager.close();
    anchoredToastManager.close();
  });
  vi.restoreAllMocks();
});

describe("ToastProvider", () => {
  test("renders title-only toast content on a measured squircle", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(44);

    render(<ToastProvider />);

    act(() => {
      toastManager.add({
        title: "A concise single-line update",
        description: "This secondary line must not render.",
        timeout: 0,
        type: "success",
      });
    });

    const title = await screen.findByText("A concise single-line update");
    const popup = title.closest('[data-slot="toast-popup"]') as HTMLElement | null;

    expect(screen.queryByText("This secondary line must not render.")).toBeNull();
    expect(title.className).toContain("truncate");
    expect(title.className).toContain("whitespace-nowrap");
    expect(popup?.className.split(" ")).toContain("w-fit");
    expect(popup?.className.split(" ")).toContain("max-w-full");
    expect(popup?.className.split(" ")).not.toContain("w-full");
    expect(popup?.dataset.squircle).toBe("14");
    await waitFor(() => {
      expect(popup?.style.clipPath).toMatch(/^path\('/);
      expect(popup?.style.borderRadius).toBe("14px");
    });
  });
});

describe("AnchoredToastProvider", () => {
  test("positions an anchored toast against a connected anchor", async () => {
    render(
      <AnchoredToastProvider>
        <button type="button">Anchor</button>
      </AnchoredToastProvider>,
    );
    const anchor = screen.getByRole("button", { name: "Anchor" });
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 24,
      left: 80,
      right: 104,
      top: 96,
      width: 24,
      x: 80,
      y: 96,
      toJSON: () => ({}),
    });
    vi.spyOn(anchor, "isConnected", "get").mockReturnValueOnce(true).mockReturnValue(false);

    act(() => {
      anchoredToastManager.add({
        title: "Following!",
        type: "success",
        timeout: 0,
        data: { tooltipStyle: true },
        positionerProps: {
          anchor,
          side: "top",
          align: "center",
          sideOffset: 6,
          positionMethod: "fixed",
        },
      });
    });

    await waitFor(() => {
      const title = screen.getByText("Following!");
      const positioner = title.closest('[data-slot="toast-positioner"]') as HTMLElement | null;
      const popup = title.closest('[data-slot="toast-popup"]') as HTMLElement | null;
      expect(positioner).not.toBeNull();
      expect(positioner?.style.position).toBe("fixed");
      expect(positioner?.style.left).toBe("92px");
      expect(positioner?.style.top).toBe("90px");
      expect(positioner?.style.transform).toBe("translate(-50%, -100%)");
      expect(title.className).toContain("whitespace-nowrap");
      expect(popup?.dataset.squircle).toBe("8");
      expect(popup?.style.borderRadius).toBe("8px");
    });
  });

  test("keeps a standard anchored toast title-only and applies its squircle path", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(240);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(44);

    render(
      <AnchoredToastProvider>
        <button type="button">Move feed</button>
      </AnchoredToastProvider>,
    );
    const anchor = screen.getByRole("button", { name: "Move feed" });
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 24,
      left: 80,
      right: 104,
      top: 96,
      width: 24,
      x: 80,
      y: 96,
      toJSON: () => ({}),
    });

    act(() => {
      anchoredToastManager.add({
        title: "Feed moved",
        description: "This secondary line must not render.",
        type: "success",
        timeout: 0,
        positionerProps: {
          anchor,
          side: "top",
          align: "center",
          sideOffset: 6,
          positionMethod: "fixed",
        },
      });
    });

    const title = await screen.findByText("Feed moved");
    const popup = title.closest('[data-slot="toast-popup"]') as HTMLElement | null;

    expect(screen.queryByText("This secondary line must not render.")).toBeNull();
    expect(title.className).toContain("whitespace-nowrap");
    expect(popup?.dataset.squircle).toBe("14");
    await waitFor(() => {
      expect(popup?.style.clipPath).toMatch(/^path\('/);
      expect(popup?.style.borderRadius).toBe("14px");
    });
  });

  test("renders an anchored toast for an anchor inside a modal dialog", async () => {
    render(
      <AnchoredToastProvider>
        <Dialog open>
          <DialogPortal>
            <DialogBackdrop />
            <DialogPrimitive.Popup aria-describedby={undefined}>
              <DialogPrimitive.Title>Add feed</DialogPrimitive.Title>
              <button type="button">Add feed</button>
            </DialogPrimitive.Popup>
          </DialogPortal>
        </Dialog>
      </AnchoredToastProvider>,
    );
    const anchor = screen.getByRole("button", { name: "Add feed" });
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 24,
      left: 80,
      right: 104,
      top: 96,
      width: 24,
      x: 80,
      y: 96,
      toJSON: () => ({}),
    });

    act(() => {
      anchoredToastManager.add({
        title: "Following!",
        type: "success",
        timeout: 0,
        data: { tooltipStyle: true },
        positionerProps: {
          anchor,
          side: "top",
          align: "center",
          sideOffset: 6,
          positionMethod: "fixed",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Following!")).toBeTruthy();
    });
  });

  test("positions an anchored toast from the enqueue-time anchor snapshot", async () => {
    render(
      <AnchoredToastProvider>
        <button type="button">Add feed</button>
      </AnchoredToastProvider>,
    );
    const anchor = screen.getByRole("button", { name: "Add feed" });
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 24,
      left: 80,
      right: 104,
      top: 96,
      width: 24,
      x: 80,
      y: 96,
      toJSON: () => ({}),
    });

    act(() => {
      anchoredToastManager.add({
        title: "Following!",
        type: "success",
        timeout: 0,
        data: { tooltipStyle: true },
        positionerProps: {
          anchor,
          side: "top",
          align: "center",
          sideOffset: 6,
          positionMethod: "fixed",
        },
      });
    });

    await waitFor(() => {
      const positioner = screen
        .getByText("Following!")
        .closest('[data-slot="toast-positioner"]') as HTMLElement | null;
      expect(positioner).not.toBeNull();
      expect(positioner?.style.left).toBe("92px");
      expect(positioner?.style.top).toBe("90px");
    });
  });

  test("updates an existing grouped anchored toast instead of stacking another one", async () => {
    render(
      <AnchoredToastProvider>
        <button type="button">Save</button>
        <button type="button">Unsave</button>
      </AnchoredToastProvider>,
    );
    const saveAnchor = screen.getByRole("button", { name: "Save" });
    const unsaveAnchor = screen.getByRole("button", { name: "Unsave" });
    vi.spyOn(saveAnchor, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 24,
      left: 80,
      right: 104,
      top: 96,
      width: 24,
      x: 80,
      y: 96,
      toJSON: () => ({}),
    });
    vi.spyOn(unsaveAnchor, "getBoundingClientRect").mockReturnValue({
      bottom: 180,
      height: 24,
      left: 200,
      right: 224,
      top: 156,
      width: 24,
      x: 200,
      y: 156,
      toJSON: () => ({}),
    });

    act(() => {
      anchoredToastManager.add({
        title: "Article saved",
        type: "success",
        timeout: 0,
        data: { groupKey: "article.saved-state", tooltipStyle: true },
        positionerProps: {
          anchor: saveAnchor,
          side: "top",
          align: "center",
          sideOffset: 6,
          positionMethod: "fixed",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Article saved")).toBeTruthy();
    });

    act(() => {
      anchoredToastManager.add({
        title: "Article unsaved",
        type: "info",
        timeout: 0,
        data: { groupKey: "article.saved-state", tooltipStyle: true },
        positionerProps: {
          anchor: unsaveAnchor,
          side: "top",
          align: "center",
          sideOffset: 6,
          positionMethod: "fixed",
        },
      });
    });

    await waitFor(() => {
      const positioner = screen
        .getByText("Article unsaved")
        .closest('[data-slot="toast-positioner"]') as HTMLElement | null;
      expect(screen.queryByText("Article saved")).toBeNull();
      expect(positioner).not.toBeNull();
      expect(positioner?.style.left).toBe("212px");
      expect(positioner?.style.top).toBe("150px");
    });
  });

  test("renders an anchored toast with the app's nested toast providers", async () => {
    render(
      <ToastProvider>
        <AnchoredToastProvider>
          <Dialog open>
            <DialogPortal>
              <DialogBackdrop />
              <DialogPrimitive.Popup aria-describedby={undefined}>
                <DialogPrimitive.Title>Add feed</DialogPrimitive.Title>
                <button type="button">Add feed</button>
              </DialogPrimitive.Popup>
            </DialogPortal>
          </Dialog>
        </AnchoredToastProvider>
      </ToastProvider>,
    );
    const anchor = screen.getByRole("button", { name: "Add feed" });
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 24,
      left: 80,
      right: 104,
      top: 96,
      width: 24,
      x: 80,
      y: 96,
      toJSON: () => ({}),
    });

    act(() => {
      anchoredToastManager.add({
        title: "Following!",
        type: "success",
        timeout: 0,
        data: { tooltipStyle: true },
        positionerProps: {
          anchor,
          side: "top",
          align: "center",
          sideOffset: 6,
          positionMethod: "fixed",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Following!")).toBeTruthy();
    });
  });
});
