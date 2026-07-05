// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AnchoredToastProvider, ToastProvider, anchoredToastManager } from "@kyomi/ui/toast";

describe("AnchoredToastProvider", () => {
  afterEach(() => {
    act(() => {
      anchoredToastManager.close();
    });
  });

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
      const positioner = screen
        .getByText("Following!")
        .closest('[data-slot="toast-positioner"]') as HTMLElement | null;
      expect(positioner).not.toBeNull();
      expect(positioner?.style.position).toBe("fixed");
      expect(positioner?.style.left).toBe("92px");
      expect(positioner?.style.top).toBe("90px");
      expect(positioner?.style.transform).toBe("translate(-50%, -100%)");
    });
  });

  test("renders an anchored toast for an anchor inside a modal dialog", async () => {
    render(
      <AnchoredToastProvider>
        <RadixDialog.Root open>
          <RadixDialog.Portal>
            <RadixDialog.Overlay />
            <RadixDialog.Content aria-describedby={undefined}>
              <RadixDialog.Title>Add feed</RadixDialog.Title>
              <button type="button">Add feed</button>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>
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
          <RadixDialog.Root open>
            <RadixDialog.Portal>
              <RadixDialog.Overlay />
              <RadixDialog.Content aria-describedby={undefined}>
                <RadixDialog.Title>Add feed</RadixDialog.Title>
                <button type="button">Add feed</button>
              </RadixDialog.Content>
            </RadixDialog.Portal>
          </RadixDialog.Root>
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
