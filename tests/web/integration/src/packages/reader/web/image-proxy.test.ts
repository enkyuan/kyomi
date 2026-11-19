// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { prepareArticleHtml } from "../../../../../../../packages/reader/src/web/html/string-prep";

const PROXY = "https://proxy.test/img?u=";
const proxy = (url: string) => `${PROXY}${encodeURIComponent(url)}`;

/** Every URL an image request could be made from, in the prepared article. */
function imageUrls(html: string): string[] {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const urls: string[] = [];
  for (const element of tpl.content.querySelectorAll("img, source, video")) {
    const tag = element.tagName.toLowerCase();
    for (const name of ["src", "srcset", "poster"]) {
      const value = element.getAttribute(name);
      if (value === null || (tag !== "img" && name === "src")) {
        continue;
      }
      urls.push(...value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0] ?? ""));
    }
  }
  return urls;
}

function prepare(html: string): string {
  return prepareArticleHtml(html, "https://publisher.example/post", undefined, proxy);
}

describe("image proxying survives the sanitizer's restructuring", () => {
  test("a <source> that only becomes a child of <picture> after sanitizing is proxied", () => {
    // `<font>` is not allowed, so the sanitizer unwraps it and `source` lands directly in `picture`.
    const out = prepare(
      '<picture><font><source srcset="https://tracker.example/pixel.png 1x"></font><img src="https://publisher.example/a.png" alt=""></picture>',
    );

    expect(out).toContain("<picture><source");
    const urls = imageUrls(out);
    expect(urls.length).toBeGreaterThanOrEqual(2);
    for (const url of urls) {
      expect(url.startsWith(PROXY), url).toBe(true);
    }
    expect(out).not.toContain('srcset="https://tracker.example');
  });

  test.each([
    ["center", "<center>", "</center>"],
    ["nested font and center", "<font><center>", "</center></font>"],
    ["marquee", "<marquee>", "</marquee>"],
    ["an unknown element", "<blink-x>", "</blink-x>"],
  ])("also when the wrapper is %s", (_name, open, close) => {
    const out = prepare(
      `<picture>${open}<source srcset="/hero.webp 1x, /hero@2x.webp 2x" type="image/webp">${close}<img src="/hero.png" alt=""></picture>`,
    );
    const urls = imageUrls(out);
    expect(urls.length).toBeGreaterThanOrEqual(3);
    for (const url of urls) {
      expect(url.startsWith(PROXY), url).toBe(true);
    }
  });

  test("a plain <picture> keeps working: every candidate goes through the proxy", () => {
    const out = prepare(
      '<picture><source type="image/webp" srcset="/a.webp 1x, /a@2x.webp 2x"><img src="/a.png" alt=""></picture>',
    );
    const tpl = document.createElement("template");
    tpl.innerHTML = out;
    expect(tpl.content.querySelector("source")?.getAttribute("srcset")).toBe(
      `${proxy("https://publisher.example/a.webp")} 1x, ${proxy("https://publisher.example/a@2x.webp")} 2x`,
    );
    expect(tpl.content.querySelector("img")?.getAttribute("src")).toBe(
      proxy("https://publisher.example/a.png"),
    );
  });

  test("media sources are resolved but not proxied: the image proxy serves images only", () => {
    const out = prepare('<video controls><source src="/clip.mp4" type="video/mp4"></video>');
    const tpl = document.createElement("template");
    tpl.innerHTML = out;
    expect(tpl.content.querySelector("source")?.getAttribute("src")).toBe(
      "https://publisher.example/clip.mp4",
    );
  });
});

test("the web route survives sanitizing and an external-looking relative transform is dropped", () => {
  const html = '<img src="/photos/cover.jpg" alt="">';
  const origin = "https://publisher.example/article";
  const path = "/api/reader-image?url=https%3A%2F%2Fpublisher.example%2Fphotos%2Fcover.jpg";
  expect(imageUrls(prepareArticleHtml(html, origin, undefined, () => path))).toEqual([
    new URL(path, window.location.origin).href,
  ]);
  expect(
    imageUrls(prepareArticleHtml(html, origin, undefined, () => "/.//elsewhere.example/photo")),
  ).toEqual([]);
});
