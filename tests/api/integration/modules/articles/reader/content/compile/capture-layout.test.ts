import { describe, expect, test } from "bun:test";
import { compileArticleHtml } from "@kyomi/worker/document";
import { runPass } from "./run-pass";

const IMG = (name: string) => `<img src="/${name}.jpg" alt="">`;

describe("capture-layout (pass 7)", () => {
  test.each([
    ["alignwide", "wide"],
    ["kg-width-wide", "wide"],
    ["alignfull", "full"],
    ["kg-width-full", "full"],
    ["alignleft", "start"],
    ["alignright", "end"],
  ])("maps the %s class to placement %s", (token, placement) => {
    const { html } = runPass(
      "capture-layout",
      `<figure class="wp-block-image ${token}">${IMG("a")}</figure>`,
    );
    expect(html).toContain(`data-kyomi-placement="${placement}"`);
  });

  test("leaves centered and unmarked media without a placement", () => {
    const { html } = runPass(
      "capture-layout",
      `<figure class="aligncenter">${IMG("a")}</figure><figure>${IMG("b")}</figure>`,
    );
    expect(html).not.toContain("data-kyomi-placement");
  });

  test("reads the legacy align attribute on images", () => {
    const { html } = runPass("capture-layout", `<p><img src="/a.jpg" alt="" align="right"></p>`);
    expect(html).toContain('data-kyomi-placement="end"');
  });

  test("marks galleries with at least two images, as carousels when the class says so", () => {
    const grid = runPass(
      "capture-layout",
      `<figure class="wp-block-gallery">${IMG("a")}${IMG("b")}</figure>`,
    ).html;
    const carousel = runPass(
      "capture-layout",
      `<div class="gallery swiper">${IMG("a")}${IMG("b")}</div>`,
    ).html;
    const single = runPass(
      "capture-layout",
      `<figure class="wp-block-gallery">${IMG("a")}</figure>`,
    ).html;
    expect(grid).toContain('data-kyomi-gallery="grid"');
    expect(carousel).toContain('data-kyomi-gallery="carousel"');
    expect(single).not.toContain("data-kyomi-gallery");
  });

  test("marks only the outermost Ghost gallery wrapper", () => {
    const { html } = runPass(
      "capture-layout",
      `<figure class="kg-card kg-gallery-card"><div class="kg-gallery-container"><div class="kg-gallery-row">${IMG("a")}${IMG("b")}</div></div></figure>`,
    );
    expect(html.match(/data-kyomi-gallery/g)).toHaveLength(1);
  });

  test("records media-text direction", () => {
    const start = runPass(
      "capture-layout",
      `<div class="wp-block-media-text"><figure>${IMG("a")}</figure><div><p>Text</p></div></div>`,
    ).html;
    const end = runPass(
      "capture-layout",
      `<div class="wp-block-media-text has-media-on-the-right"><figure>${IMG("a")}</figure><div><p>Text</p></div></div>`,
    ).html;
    expect(start).toContain('data-kyomi-media-text="start"');
    expect(end).toContain('data-kyomi-media-text="end"');
  });

  test.each([
    [
      `<div class="admonition warning"><p class="admonition-title">Warning</p><p>Body</p></div>`,
      "warning",
    ],
    [
      `<div class="markdown-alert markdown-alert-tip"><p class="markdown-alert-title">Tip</p><p>Body</p></div>`,
      "tip",
    ],
    [
      `<div class="theme-admonition theme-admonition-danger"><div class="admonitionHeading_x">danger</div><div><p>Body</p></div></div>`,
      "caution",
    ],
    [`<div class="callout"><p>Unlabelled</p></div>`, "note"],
  ])("labels callout %#", (markup, variant) => {
    const { html } = runPass("capture-layout", markup);
    expect(html).toContain(`data-kyomi-callout="${variant}"`);
  });

  test("marks the callout title element", () => {
    const { html } = runPass(
      "capture-layout",
      `<div class="admonition note"><p class="admonition-title">Note</p><p>Body</p></div>`,
    );
    expect(html).toContain('data-kyomi-role="callout-title"');
  });

  test("does not treat a section with headings as a callout", () => {
    const { html } = runPass(
      "capture-layout",
      `<div class="alert"><h2>Big section</h2><p>Body</p></div>`,
    );
    expect(html).not.toContain("data-kyomi-callout");
  });

  test("labels pullquotes, captions, credits, sidenotes, and footnotes", () => {
    const { html } = runPass(
      "capture-layout",
      `<aside class="pullquote"><p>Quote</p></aside>
       <p class="wp-caption-text">Caption</p>
       <span class="photo-credit">Credit</span>
       <span class="sidenote">Aside</span>
       <section class="footnotes"><ol><li id="kyomi-fn1">Note</li></ol></section>
       <div class="footnote"><a id="kyomi-fn2" href="#kyomi-r2">2</a><div><p>Body</p></div></div>`,
    );
    for (const role of ["pullquote", "caption", "credit", "sidenote", "footnotes", "footnote"]) {
      expect(html).toContain(`data-kyomi-role="${role}"`);
    }
  });

  test("a single footnote inside a footnotes container is not labelled separately", () => {
    const { html } = runPass(
      "capture-layout",
      `<section class="footnotes"><div class="footnote">N</div></section>`,
    );
    expect(html.match(/data-kyomi-role="footnote"/g)).toBeNull();
  });

  describe("publisher adapters", () => {
    test("Ghost bookmark cards become a labelled block", () => {
      const { html } = runPass(
        "capture-layout",
        `<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="https://docs.example.org/g"><div class="kg-bookmark-content"><div class="kg-bookmark-title">Guide</div><div class="kg-bookmark-description">About it.</div><div class="kg-bookmark-metadata"><span class="kg-bookmark-publisher">Docs</span></div></div><div class="kg-bookmark-thumbnail"><img src="https://docs.example.org/og.png" alt=""></div></a></figure>`,
      );
      expect(html).toContain('data-kyomi-role="bookmark"');
      expect(html).toContain("<p>About it.</p>");
      expect(html).toContain("<p>Docs</p>");
    });

    test("Ghost toggle cards become native details", () => {
      const { html } = runPass(
        "capture-layout",
        `<div class="kg-card kg-toggle-card"><div class="kg-toggle-heading"><h4 class="kg-toggle-heading-text">Why?</h4></div><div class="kg-toggle-content"><p>Because.</p></div></div>`,
      );
      expect(html).toContain("<details><summary>Why?</summary><p>Because.</p></details>");
    });

    test("Ghost audio player chrome is removed", () => {
      const { html } = runPass(
        "capture-layout",
        `<div class="kg-card kg-audio-card"><audio src="/a.mp3"></audio><div class="kg-audio-title">Talk</div><div class="kg-audio-player"><span>0:00</span></div></div>`,
      );
      expect(html).toContain("Talk");
      expect(html).not.toContain("0:00");
    });

    test("WordPress classic captions become a figure with a figcaption", () => {
      const { html } = runPass(
        "capture-layout",
        `<div class="wp-caption alignright"><img src="/a.jpg" alt=""><p class="wp-caption-text">Caption</p></div>`,
      );
      expect(html).toContain("<figcaption>Caption</figcaption>");
      expect(html).toContain("<figure");
      expect(html).not.toContain("wp-caption-text");
    });

    test("Substack unwraps the captioned-image container", () => {
      const { html } = runPass(
        "capture-layout",
        `<div class="captioned-image-container"><figure>${IMG("a")}<figcaption>C</figcaption></figure></div>`,
      );
      expect(html.startsWith("<figure")).toBe(true);
    });
  });

  test("hints survive sanitizing and forged ones do not", () => {
    const compiled = compileArticleHtml(
      `<figure class="alignwide" data-kyomi-placement="full">${IMG("a")}</figure><p data-kyomi-role="pullquote">Forged</p>`,
      { baseUrl: "https://example.com/" },
    ).html;
    expect(compiled).toContain('data-kyomi-placement="wide"');
    expect(compiled).not.toContain('data-kyomi-placement="full"');
    expect(compiled).not.toContain("data-kyomi-role");
  });
});
