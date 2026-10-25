// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { findReaderBody, measureReaderBody } from "@modules/reader/lib/progress";

function layout(element: HTMLElement, values: Record<string, number>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(element, key, { configurable: true, value });
  }
}

function rect(top: number): DOMRect {
  return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top } as DOMRect;
}

describe("measureReaderBody", () => {
  let viewport: HTMLDivElement;
  let body: HTMLDivElement;

  beforeEach(() => {
    viewport = document.createElement("div");
    body = document.createElement("div");
    body.setAttribute("data-reader-body", "a");
    viewport.append(body);
    document.body.append(viewport);
    layout(viewport, { clientHeight: 800, scrollTop: 0 });
    layout(body, { offsetHeight: 2_000 });
    viewport.getBoundingClientRect = () => rect(50);
    body.getBoundingClientRect = () => rect(150);
  });

  afterEach(() => {
    viewport.remove();
    vi.unstubAllGlobals();
  });

  test("finds the body by article id so an exiting article never matches", () => {
    const exiting = document.createElement("div");
    exiting.setAttribute("data-reader-body", "old");
    viewport.prepend(exiting);

    expect(findReaderBody(viewport, "a")).toBe(body);
    expect(findReaderBody(viewport, "old")).toBe(exiting);
    expect(findReaderBody(viewport, "missing")).toBeNull();
  });

  test("returns scroll metrics with the body offset inside the scroll content", () => {
    layout(viewport, { scrollTop: 300 });
    // The body sits 100px below the viewport top; after 300px of scroll it reads -200 on screen.
    body.getBoundingClientRect = () => rect(-150);

    expect(measureReaderBody(viewport, "a")).toEqual({
      scrollTop: 300,
      viewportHeight: 800,
      contentTop: 100,
      contentHeight: 2_000,
      endVisible: false,
    });
  });

  test("reports the end once the body's bottom is inside the viewport", () => {
    layout(viewport, { scrollTop: 1_300 });
    body.getBoundingClientRect = () => rect(50 - 1_200);

    expect(measureReaderBody(viewport, "a")?.endVisible).toBe(true);
  });

  test("returns null until the body is laid out", () => {
    layout(body, { offsetHeight: 0 });

    expect(measureReaderBody(viewport, "a")).toBeNull();
    expect(measureReaderBody(viewport, "missing")).toBeNull();
  });

  test("ignores the enter animation's translation", () => {
    vi.stubGlobal(
      "DOMMatrixReadOnly",
      class {
        m42 = 56;
      },
    );
    const animated = document.createElement("div");
    viewport.append(animated);
    animated.append(body);
    animated.style.transform = "translateY(56px)";
    // The body is drawn 56px lower than its layout position.
    body.getBoundingClientRect = () => rect(150 + 56);

    expect(measureReaderBody(viewport, "a")?.contentTop).toBe(100);
  });
});
