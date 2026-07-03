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
