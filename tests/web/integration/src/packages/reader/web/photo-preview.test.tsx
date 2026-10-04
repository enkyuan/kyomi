// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { RenderHtml } from "@kyomi/reader/web";

describe("reader photo preview", () => {
  test("opens block reader images in a photo preview", async () => {
    const html = `
      <figure>
        <img src="https://example.com/photo.jpg" alt="Previewable image" />
      </figure>
    `;
    const { container } = render(<RenderHtml html={html} baseUrl="https://example.com/p" />);
    const root = container.querySelector(".article-body");

    await waitFor(() => {
      const frame = root?.querySelector<HTMLElement>("[data-reader-img-frame]");
      expect(frame?.getAttribute("data-reader-photo-view")).toBe("");
      expect(frame?.getAttribute("role")).toBe("button");
      expect(frame?.getAttribute("tabindex")).toBe("0");
    });

    const frame = root?.querySelector<HTMLElement>("[data-reader-img-frame]");
    expect(frame).toBeTruthy();
    fireEvent.click(frame!);

    await waitFor(() => {
      expect(document.body.querySelector(".PhotoView-Portal")).toBeTruthy();
      expect(document.body.querySelector(".PhotoView__Photo")?.getAttribute("src")).toBe(
        "https://example.com/photo.jpg",
      );
      expect(
        (document.body.querySelector(".PhotoView-Slider__Backdrop") as HTMLElement | null)?.style
          .animationDuration,
      ).toBe("180ms");
    });
  });

  test("opens without motion from the keyboard", async () => {
    const { container } = render(
      <RenderHtml
        html='<figure><img src="https://example.com/photo.jpg" alt="Previewable image" /></figure>'
        baseUrl="https://example.com/p"
      />,
    );

    const root = container.querySelector(".article-body");
    await waitFor(() => {
      expect(root?.querySelector("[data-reader-photo-view]")).toBeTruthy();
    });

    fireEvent.keyDown(root!.querySelector<HTMLElement>("[data-reader-photo-view]")!, {
      key: "Enter",
    });

    await waitFor(() => {
      expect(
        (document.body.querySelector(".PhotoView-Slider__Backdrop") as HTMLElement | null)?.style
          .animationDuration,
      ).toBe("0ms");
    });
  });
});
