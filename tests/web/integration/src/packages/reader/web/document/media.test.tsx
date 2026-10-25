// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { ReaderBlock } from "@kyomi/reader/document";
import { RenderDocument } from "@kyomi/reader/web";
import { documentOf, everyBlock } from "./fixtures";
import { renderBlocks } from "./render";

describe("figures and galleries", () => {
  test("figure frames the image with caption, credit and placement", () => {
    const figure = everyBlock.find((block) => block.type === "figure")!;
    const { body } = renderBlocks([figure]);
    const el = body.querySelector("figure")!;
    expect(el.getAttribute("data-reader-placement")).toBe("wide");
    const img = el.querySelector("[data-reader-img-frame] > img")!;
    expect(img.getAttribute("src")).toBe("https://cdn.example/a.png");
    expect(img.getAttribute("srcset")).toBe("https://cdn.example/a@2x.png 2048w");
    expect(img.getAttribute("width")).toBe("1024");
    expect(img.getAttribute("height")).toBe("576");
    expect(el.querySelector("figcaption")?.textContent).toBe("A diagram.");
    expect(el.querySelector("[data-reader-figure-credit]")?.textContent).toBe("Photo: Someone");
  });

  test("every image request goes through the transport and non-http results are dropped", () => {
    const figure = everyBlock.find((block) => block.type === "figure")!;
    const transformImageUrl = (url: string) =>
      url.includes("@2x") ? "data:text/html,x" : `https://proxy.test/?u=${encodeURIComponent(url)}`;
    const { body } = renderBlocks([figure], { transformImageUrl });
    const img = body.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(
      `https://proxy.test/?u=${encodeURIComponent("https://cdn.example/a.png")}`,
    );
    expect(img.hasAttribute("srcset")).toBe(false);
  });

  test("a failed image becomes an unavailable note carrying its description", () => {
    const figure = everyBlock.find((block) => block.type === "figure")!;
    const { body } = renderBlocks([figure]);
    fireEvent.error(body.querySelector("img")!);
    const note = body.querySelector("[data-reader-img-unavailable] [role='note']")!;
    expect(note.getAttribute("aria-label")).toBe("Image unavailable: A diagram.");
    expect(body.querySelector("img")).toBeNull();
  });

  test("images reveal once loaded", () => {
    const figure = everyBlock.find((block) => block.type === "figure")!;
    const { body } = renderBlocks([figure]);
    const frame = body.querySelector("[data-reader-img-frame]")!;
    expect(frame.getAttribute("data-reader-img-loading")).toBe("true");
    fireEvent.load(body.querySelector("img")!);
    expect(frame.hasAttribute("data-reader-img-loading")).toBe(false);
    expect(body.querySelector("img")?.className).not.toContain("opacity-0");
  });

  test("image loading follows the preference", () => {
    const figure = everyBlock.find((block) => block.type === "figure")!;
    expect(
      renderBlocks([figure], { imageLoading: "eager" })
        .body.querySelector("img")
        ?.getAttribute("loading"),
    ).toBe("eager");
  });

  test("grid and carousel galleries render every item with captions", () => {
    const galleries = everyBlock.filter((block) => block.type === "gallery");
    const { body } = renderBlocks(galleries);
    const [grid, carousel] = body.querySelectorAll("[data-reader-gallery]");
    expect(grid?.getAttribute("data-reader-gallery")).toBe("grid");
    expect(grid?.querySelectorAll("img")).toHaveLength(2);
    expect(grid?.querySelector("figcaption")?.textContent).toBe("Before and after.");
    expect(
      within(grid as HTMLElement).getByText("Before", { selector: "[data-reader-figure-caption]" }),
    ).toBeTruthy();
    expect(carousel?.getAttribute("data-reader-gallery")).toBe("carousel");
    expect(carousel?.querySelector("[aria-roledescription='carousel']")).toBeTruthy();
  });

  test("clicking an image opens the shared photo viewer on that image", async () => {
    const galleries = everyBlock.filter((block) => block.type === "gallery");
    const { body } = renderBlocks(galleries);
    const second = body.querySelectorAll<HTMLElement>("[data-reader-photo-view]")[1]!;
    fireEvent.click(second);
    await waitFor(() => {
      expect(document.body.querySelector(".PhotoView-Portal")).toBeTruthy();
      expect(document.body.querySelector(".PhotoView-Slider__Counter")?.textContent).toBe("2 / 4");
    });
  });

  test("embed snapshot images open in the photo viewer", async () => {
    const snapshotEmbed: ReaderBlock = {
      type: "embed",
      provider: "bluesky",
      placement: "content",
      url: "https://bsky.app/profile/a.example/post/3abc",
      snapshot: {
        text: [{ type: "text", value: "Post" }],
        media: [
          { src: "https://cdn.example/post-1.png", alt: "One" },
          { src: "https://cdn.example/post-2.png", alt: "Two" },
        ],
        fetchedAt: "2026-10-21T12:00:00.000Z",
      },
    };
    const { body } = renderBlocks([snapshotEmbed]);
    fireEvent.click(body.querySelectorAll<HTMLElement>("[data-reader-photo-view]")[1]!);
    await waitFor(() => {
      expect(document.body.querySelector(".PhotoView-Slider__Counter")?.textContent).toBe("2 / 2");
    });
  });

  test("a new image source at the same position loads instead of keeping a failed state", () => {
    const figure = everyBlock.find((block) => block.type === "figure")!;
    const { body, rerender } = renderBlocks([figure]);
    fireEvent.error(body.querySelector("img")!);
    expect(body.querySelector("[data-reader-img-unavailable]")).toBeTruthy();
    const replaced = {
      ...figure,
      image: {
        ...(figure as Extract<ReaderBlock, { type: "figure" }>).image,
        src: "https://cdn.example/b.png",
        srcset: undefined,
      },
    } as ReaderBlock;
    rerender(<RenderDocument document={documentOf([replaced])} showLinkPreviews={false} />);
    expect(body.querySelector("[data-reader-img-unavailable]")).toBeNull();
    expect(body.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/b.png");
  });

  test("keyboard activation opens the viewer without motion", async () => {
    const figure = everyBlock.find((block) => block.type === "figure")!;
    const { body } = renderBlocks([figure]);
    // jsdom reports detail 0 for synthetic keyboard-style clicks.
    fireEvent.click(body.querySelector("[data-reader-photo-view]")!, { detail: 0 });
    await waitFor(() => {
      expect(
        (document.body.querySelector(".PhotoView-Slider__Backdrop") as HTMLElement | null)?.style
          .animationDuration,
      ).toBe("0ms");
    });
  });

  test("media-text puts the image first or last and keeps its text", () => {
    const mediaText = everyBlock.find((block) => block.type === "mediaText")!;
    const { body } = renderBlocks([mediaText]);
    const aside = body.querySelector("[data-reader-media-aside]")!;
    expect(aside.className).toContain("flex-row-reverse");
    expect(aside.querySelector("img")?.getAttribute("alt")).toBe("Team");
    expect(aside.textContent).toContain("Built by three people.");
  });
});

describe("media", () => {
  test("video and audio use native controls and proxy the poster", () => {
    const transformImageUrl = (url: string) => `https://proxy.test/?u=${encodeURIComponent(url)}`;
    const { body } = renderBlocks(
      everyBlock.filter((block) => block.type === "video" || block.type === "audio"),
      { transformImageUrl },
    );
    const video = body.querySelector("video")!;
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.getAttribute("poster")).toBe(
      `https://proxy.test/?u=${encodeURIComponent("https://media.example/v.jpg")}`,
    );
    expect(video.querySelector("source")?.getAttribute("src")).toBe("https://media.example/v.mp4");
    expect(body.querySelector("audio source")?.getAttribute("type")).toBe("audio/mpeg");
    expect(body.textContent).toContain("Episode 1");
  });
});

describe("embeds", () => {
  const embeds = everyBlock.filter((block) => block.type === "embed");

  test("a player is a click-to-load sandboxed frame", () => {
    const { body } = renderBlocks([embeds[0]!]);
    expect(body.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Load YouTube player/ }));
    const frame = body.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk");
    expect(frame.getAttribute("sandbox")).toContain("allow-scripts");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(body.querySelector("figure[data-kyomi-embed='youtube'] figcaption")?.textContent).toBe(
      "A talk.",
    );
  });

  test("never frames a URL outside the provider's host", () => {
    for (const frameUrl of [
      "https://evil.example/embed/x",
      "http://www.youtube-nocookie.com/embed/x",
      "javascript:alert(1)",
    ]) {
      const block = { ...embeds[0]!, frameUrl } as ReaderBlock;
      const { body, unmount } = renderBlocks([block]);
      expect(screen.queryByRole("button", { name: /Load YouTube/ })).toBeNull();
      expect(body.querySelector("iframe")).toBeNull();
      expect(body.querySelector("a")?.getAttribute("href")).toBe(
        "https://www.youtube.com/watch?v=abcdefghijk",
      );
      unmount();
    }
  });

  test("a snapshot renders author, text and a link back without any provider script", () => {
    const { body } = renderBlocks([embeds[1]!]);
    const card = body.querySelector("figure[data-kyomi-embed='bluesky']")!;
    expect(card.textContent).toContain("Ada");
    expect(card.textContent).toContain("@ada.example");
    expect(card.textContent).toContain("Snapshot post text.");
    expect(
      card.querySelector("a[href='https://bsky.app/profile/a.example/post/3abc']"),
    ).toBeTruthy();
    expect(body.querySelector("iframe, script")).toBeNull();
  });

  test("a provider with neither frame nor snapshot degrades to a link card", () => {
    const { body } = renderBlocks([embeds[2]!]);
    const link = body.querySelector("figure[data-kyomi-embed='tiktok'] a")!;
    expect(link.getAttribute("href")).toBe("https://www.tiktok.com/@a/video/123");
  });

  test("link cards show title, description, site and a proxied image", () => {
    const transformImageUrl = (url: string) => `https://proxy.test/?u=${encodeURIComponent(url)}`;
    const card = everyBlock.find((block) => block.type === "linkCard")!;
    const { body } = renderBlocks([card], { transformImageUrl });
    const link = body.querySelector<HTMLAnchorElement>("a[data-reader-link-card]")!;
    expect(link.getAttribute("href")).toBe("https://example.org/story");
    expect(link.textContent).toContain("A story");
    expect(link.textContent).toContain("Why it matters.");
    expect(link.textContent).toContain("Example");
    expect(link.querySelector("img")?.getAttribute("src")).toBe(
      `https://proxy.test/?u=${encodeURIComponent("https://cdn.example/card.png")}`,
    );
  });
});
