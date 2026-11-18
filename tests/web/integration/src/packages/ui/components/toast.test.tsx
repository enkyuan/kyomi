// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Dialog, DialogBackdrop, DialogPortal, DialogPrimitive } from "@kyomi/ui/components/dialog";
import {
  AnchoredToastProvider,
  ToastProvider,
  anchoredToastManager,
  toastManager,
} from "@kyomi/ui/components/toast";

function toastNode(selector: string): Element {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`No element matches ${selector}`);
  }
  return node;
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    // A single-line toast is 360 x 40; the squircle path is measured from this.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
  });

  afterEach(() => {
    act(() => {
      toastManager.close();
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function showToast(options: Parameters<typeof toastManager.add>[0]) {
    act(() => {
      toastManager.add({ timeout: 0, ...options });
    });
  }

  test("draws one line: a status icon and a title, never a description", async () => {
    render(<ToastProvider>{null}</ToastProvider>);

    // The managers refuse a description at compile time; a stale caller must still not draw one.
    showToast({ title: "Report sent", description: "Thanks.", type: "success" } as never);

    await waitFor(() => {
      expect(screen.getByText("Report sent")).toBeTruthy();
    });
    expect(screen.queryByText("Thanks.")).toBeNull();
    expect(document.querySelector('[data-slot="toast-description"]')).toBeNull();
    expect(toastNode('[data-slot="toast-icon"] svg')).toBeTruthy();
  });

  test("gives every toast type its own status icon", async () => {
    render(<ToastProvider>{null}</ToastProvider>);
    const types = ["success", "error", "info", "warning", "loading"] as const;

    for (const type of types) {
      showToast({ title: `Toast ${type}`, type });
    }

    await waitFor(() => {
      expect(document.querySelectorAll('[data-slot="toast-icon"] svg')).toHaveLength(types.length);
    });
    const markup = new Set(
      [...document.querySelectorAll('[data-slot="toast-icon"] svg')].map((svg) => svg.innerHTML),
    );
    expect(markup.size).toBe(types.length);
  });

  test("ends the line with a count, tabular so it does not jitter as it climbs", async () => {
    render(<ToastProvider>{null}</ToastProvider>);

    showToast({
      title: "Importing feeds",
      type: "loading",
      data: { progress: { value: 4, max: 10, label: "OPML import progress" } },
    });

    await waitFor(() => {
      // The morph keeps a visually hidden copy for assistive tech, so the text appears twice.
      expect(toastNode('[data-slot="toast-count"]').textContent).toContain("4/10");
    });
    const title = toastNode('[data-slot="toast-title"]');
    const count = toastNode('[data-slot="toast-count"]');
    expect(title.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(count.className).toContain("tabular-nums");
    // The title takes the free space, which is what pushes the count to the end edge.
    expect(title.className).toContain("flex-1");
  });

  test("steps the count and the ring together, up and down, in tabular digits", async () => {
    render(<ToastProvider>{null}</ToastProvider>);
    const label = "OPML import progress";
    let id = "";
    act(() => {
      id = toastManager.add({
        title: "Importing feeds",
        type: "loading",
        timeout: 0,
        data: { progress: { value: 4, max: 10, label } },
      });
    });
    const ringOffset = () =>
      Number(
        toastNode('[data-slot="toast-icon"] svg circle:last-of-type').getAttribute(
          "stroke-dashoffset",
        ),
      );
    const setProgress = (value: number) =>
      act(() => {
        toastManager.update(id, { data: { progress: { value, max: 10, label } } });
      });

    await waitFor(() => {
      expect(toastNode('[data-slot="toast-count"]').textContent).toContain("4/10");
    });
    const atFour = ringOffset();
    // Digits keep one width, so a step never moves the title or the end edge.
    expect(toastNode('[data-slot="toast-count"]').className).toContain("tabular-nums");

    setProgress(5);
    await waitFor(() => {
      expect(toastNode('[data-slot="toast-count"]').textContent).toContain("5/10");
    });
    expect(ringOffset()).toBeLessThan(atFour);

    setProgress(3);
    await waitFor(() => {
      expect(toastNode('[data-slot="toast-count"]').textContent).toContain("3/10");
    });
    expect(ringOffset()).toBeGreaterThan(atFour);
  });

  test("ends the line with the toast's action", async () => {
    const onUndo = vi.fn();
    render(<ToastProvider>{null}</ToastProvider>);

    showToast({
      title: "Article hidden",
      type: "success",
      actionProps: { children: "Undo", onClick: onUndo },
    });

    const action = await screen.findByRole("button", { name: "Undo" });
    const title = toastNode('[data-slot="toast-title"]');
    expect(title.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(action);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  test("shapes the glass as a squircle and strokes its edge along the same path", async () => {
    render(<ToastProvider>{null}</ToastProvider>);

    showToast({ title: "Folder created", type: "success" });

    await waitFor(() => {
      expect(document.querySelector('[data-slot="toast-surface"] svg path')).not.toBeNull();
    });
    const surface = toastNode('[data-slot="toast-surface"]') as HTMLElement;
    const edge = toastNode('[data-slot="toast-surface"] svg path');
    expect(surface.style.borderRadius).toBe("14px");
    expect(edge.getAttribute("d")).toMatch(/^M/);
    expect(edge.getAttribute("stroke")).toMatch(/^url\(#toast-edge-/);
  });
});

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
