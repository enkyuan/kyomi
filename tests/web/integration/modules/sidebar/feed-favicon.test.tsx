import { buildClientFaviconUrl } from "@kyomi/worker/favicon/browser";
import { buildFaviconUrlCandidates } from "@modules/sidebar/lib/favicon";
import {
  clearFaviconMetadataMemoryCache,
  writeCachedFaviconMiss,
} from "@modules/sidebar/lib/favicon-cache";
import { SourceRow } from "@modules/feeds/components/item/source-row";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("feed favicons", () => {
  beforeEach(() => {
    clearFaviconMetadataMemoryCache();
    document.head.innerHTML = "";
  });

  test("prefers stored favicon URL over proxy fallback", () => {
    const url = buildClientFaviconUrl(
      "https://cdn.example.com/icon.png",
      "https://example.com",
      "https://example.com/feed.xml",
    );
    expect(url).toBe("https://cdn.example.com/icon.png");
  });

  test("falls back to favicon proxy when stored metadata is missing", () => {
    const url = buildClientFaviconUrl(
      null,
      "https://example.com/posts",
      "https://example.com/feed.xml",
    );
    expect(url).toBe("/api/favicon?domain=https%3A%2F%2Fexample.com&v=4");
  });

  test("rejects non-http/https feed URLs (no proxy for data:/file: URIs)", () => {
    const url = buildClientFaviconUrl(null, null, "file:///etc/hosts");
    expect(url).toBeNull();
  });

  test("prioritizes the high-resolution proxy before stored favicon metadata", () => {
    const urls = buildFaviconUrlCandidates(
      "https://cdn.example.com/icon.png",
      "https://example.com/posts",
      "https://example.com/feed.xml",
    );

    expect(urls).toEqual([
      "/api/favicon?domain=https%3A%2F%2Fexample.com&v=4",
      "https://cdn.example.com/icon.png",
      "https://example.com/favicon.ico",
    ]);
  });

  test("includes direct-origin favicon fallback when stored metadata is missing", () => {
    const urls = buildFaviconUrlCandidates(null, "https://techcrunch.com/news", "https://rss.tc");
    expect(urls).toEqual([
      "/api/favicon?domain=https%3A%2F%2Ftechcrunch.com&v=4",
      "https://techcrunch.com/favicon.ico",
    ]);
  });

  test("uses feed origin when site URL is unavailable", () => {
    const urls = buildFaviconUrlCandidates(null, null, "https://feeds.techcrunch.com/rss.xml");
    expect(urls).toEqual([
      "/api/favicon?domain=https%3A%2F%2Ffeeds.techcrunch.com&v=4",
      "https://feeds.techcrunch.com/favicon.ico",
    ]);
  });

  test("renders the RSS fallback immediately behind the favicon image", () => {
    const { container } = render(
      <FeedFavicon
        faviconUrl={null}
        feedUrl="https://feeds.techcrunch.com/rss.xml"
        siteUrl="https://techcrunch.com/article"
        title="TechCrunch"
      />,
    );

    const img = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(img.className).toContain("opacity-0");
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  test("uses eager high-priority loading for large sidebar favicons", async () => {
    render(
      <FeedFavicon
        faviconUrl={null}
        feedUrl="https://news.ycombinator.com/rss"
        priority="high"
        siteUrl="https://news.ycombinator.com"
        title="Hacker News"
      />,
    );

    const img = screen.getByRole("img", { name: "Hacker News favicon" });
    expect(img.getAttribute("loading")).toBe("eager");
    expect(img.getAttribute("fetchpriority")).toBe("high");
    await waitFor(() => {
      expect(document.head.querySelector('link[rel="preload"]')).not.toBeNull();
    });
  });

  test("shows an already-complete eager sidebar favicon", async () => {
    const completeSpy = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(true);
    const naturalWidthSpy = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(32);
    const naturalHeightSpy = vi
      .spyOn(HTMLImageElement.prototype, "naturalHeight", "get")
      .mockReturnValue(32);

    try {
      render(
        <FeedFavicon
          faviconUrl="https://news.ycombinator.com/y18.svg"
          feedUrl="https://news.ycombinator.com/rss"
          priority="high"
          siteUrl="https://news.ycombinator.com"
          title="Hacker News"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("img", { name: "Hacker News favicon" }).className).toContain(
          "opacity-100",
        );
      });
    } finally {
      completeSpy.mockRestore();
      naturalWidthSpy.mockRestore();
      naturalHeightSpy.mockRestore();
    }
  });

  test("falls back from proxy to direct favicon and then RSS icon", () => {
    render(
      <FeedFavicon
        faviconUrl={null}
        feedUrl="https://feeds.techcrunch.com/rss.xml"
        siteUrl="https://techcrunch.com/article"
        title="TechCrunch"
      />,
    );

    const proxyImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(proxyImg.getAttribute("src")).toBe(
      "/api/favicon?domain=https%3A%2F%2Ftechcrunch.com&v=4",
    );

    fireEvent.error(proxyImg);
    const directImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(directImg.getAttribute("src")).toBe("https://techcrunch.com/favicon.ico");

    fireEvent.error(directImg);
    expect(screen.queryByRole("img", { name: "TechCrunch favicon" })).toBeNull();
    expect(screen.getByLabelText("TechCrunch feed")).not.toBeNull();
  });

  test("shows a successfully loaded favicon even when it is low resolution", () => {
    render(
      <FeedFavicon
        faviconUrl={null}
        feedUrl="https://feeds.techcrunch.com/rss.xml"
        siteUrl="https://techcrunch.com/article"
        title="TechCrunch"
      />,
    );

    const proxyImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    Object.defineProperty(proxyImg, "naturalWidth", { configurable: true, value: 16 });
    Object.defineProperty(proxyImg, "naturalHeight", { configurable: true, value: 16 });
    fireEvent.load(proxyImg);

    expect(screen.getByRole("img", { name: "TechCrunch favicon" }).getAttribute("src")).toBe(
      "/api/favicon?domain=https%3A%2F%2Ftechcrunch.com&v=4",
    );
    expect(screen.getByRole("img", { name: "TechCrunch favicon" }).className).toContain(
      "opacity-100",
    );
    expect(screen.queryByLabelText("TechCrunch feed")).toBeNull();
  });

  test("tries the high-resolution proxy before persisted feed favicon metadata", () => {
    render(
      <FeedFavicon
        faviconUrl="https://cdn.techcrunch.example/icon.png"
        feedUrl="https://feeds.techcrunch.example/rss.xml"
        siteUrl="https://fresh.techcrunch.example/article"
        title="TechCrunch"
      />,
    );

    const proxyImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(proxyImg.getAttribute("src")).toBe(
      "/api/favicon?domain=https%3A%2F%2Ffresh.techcrunch.example&v=4",
    );

    fireEvent.error(proxyImg);
    const storedImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(storedImg.getAttribute("src")).toBe("https://cdn.techcrunch.example/icon.png");
  });

  test("keeps stored favicon candidates after a cached proxy miss", () => {
    writeCachedFaviconMiss("https://fresh.techcrunch.example");

    render(
      <FeedFavicon
        faviconUrl="https://cdn.techcrunch.example/icon.png"
        feedUrl="https://feeds.techcrunch.example/rss.xml"
        siteUrl="https://fresh.techcrunch.example/article"
        title="TechCrunch"
      />,
    );

    expect(screen.getByRole("img", { name: "TechCrunch favicon" }).getAttribute("src")).toBe(
      "https://cdn.techcrunch.example/icon.png",
    );
  });

  test("keeps scalable SVG favicons even when their intrinsic size is small", () => {
    render(
      <FeedFavicon
        faviconUrl="https://news.ycombinator.com/y18.svg"
        feedUrl="https://news.ycombinator.com/rss"
        siteUrl="https://news.ycombinator.com"
        title="Hacker News"
      />,
    );

    const proxyImg = screen.getByRole("img", { name: "Hacker News favicon" });
    fireEvent.error(proxyImg);

    const storedImg = screen.getByRole("img", { name: "Hacker News favicon" });
    expect(storedImg.getAttribute("src")).toBe("https://news.ycombinator.com/y18.svg");
    Object.defineProperty(storedImg, "naturalWidth", { configurable: true, value: 18 });
    Object.defineProperty(storedImg, "naturalHeight", { configurable: true, value: 18 });
    fireEvent.load(storedImg);

    expect(screen.getByRole("img", { name: "Hacker News favicon" }).getAttribute("src")).toBe(
      "https://news.ycombinator.com/y18.svg",
    );
  });

  test("source rows fall back through feed origin instead of article origin", () => {
    render(
      <SourceRow
        articleUrl="https://en.wikipedia.org/wiki/Forestiere_Underground_Gardens"
        feedFaviconUrl="https://news.ycombinator.com/y18.svg"
        feedSiteUrl="https://news.ycombinator.com"
        feedTitle="Hacker News"
        feedUrl="https://news.ycombinator.com/rss"
        enablePreview={false}
      />,
    );

    const proxyImg = screen.getByRole("img", { name: "Hacker News favicon" });
    expect(proxyImg.getAttribute("src")).toBe(
      "/api/favicon?domain=https%3A%2F%2Fnews.ycombinator.com&v=4",
    );

    fireEvent.error(proxyImg);
    expect(screen.getByRole("img", { name: "Hacker News favicon" }).getAttribute("src")).toBe(
      "https://news.ycombinator.com/y18.svg",
    );
  });
});
