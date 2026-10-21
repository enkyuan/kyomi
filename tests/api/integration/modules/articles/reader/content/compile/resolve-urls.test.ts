import { describe, expect, test } from "bun:test";
import { runPass } from "./run-pass";

describe("compiler pass: resolve-urls", () => {
  test("absolutizes links, media, posters, and every srcset candidate", () => {
    const { html } = runPass(
      "resolve-urls",
      `<a href="../about">About</a><img src="img/a.png" srcset="img/a.png 1x, /img/a@2x.png 2x, javascript:alert(1) 3x" alt=""><video src="/v.mp4" poster="v.jpg"></video><source src="/a.mp3">`,
    );

    expect(html).toContain('<a href="https://example.com/about">About</a>');
    expect(html).toContain(
      'src="https://example.com/posts/img/a.png" srcset="https://example.com/posts/img/a.png 1x, https://example.com/img/a@2x.png 2x"',
    );
    expect(html).toContain(
      '<video poster="https://example.com/posts/v.jpg" src="https://example.com/v.mp4">',
    );
    expect(html).toContain('<source src="https://example.com/a.mp3">');
  });

  test("drops URLs that do not resolve to http(s)", () => {
    const { html } = runPass(
      "resolve-urls",
      `<a href="javascript:alert(1)">x</a><a href="mailto:a@example.com">mail</a><img src="ftp://example.com/a.png" alt="">`,
    );

    expect(html).toBe('<a>x</a><a>mail</a><img alt="">');
  });

  test("rewrites ids to unique kyomi- anchors and points in-page links at them", () => {
    const { html } = runPass(
      "resolve-urls",
      `<sup><a href="#fn:1">1</a></sup><a href="#S1.E1">eq</a><a href="https://example.com/posts/entry#fn:1">long form</a>
       <li id="fn:1">Note</li><table id="S1.E1"></table><h2 id="Fn-1">Clash</h2><h2 id="__proto__">Proto</h2>`,
    );

    expect(html).toContain('<a href="#kyomi-fn-1">1</a>');
    expect(html).toContain('<a href="#kyomi-s1-e1">eq</a>');
    expect(html).toContain('<a href="#kyomi-fn-1">long form</a>');
    expect(html).toContain('<li id="kyomi-fn-1">Note</li>');
    expect(html).toContain('<h2 id="kyomi-fn-1-2">Clash</h2>');
    expect(html).toContain('<h2 id="kyomi-proto">Proto</h2>');
  });

  test("turns legacy a[name] targets into anchors and drops links to missing targets", () => {
    const { html } = runPass(
      "resolve-urls",
      `<a href="#notes">Notes</a> <a href="#missing">Missing</a> <a name="notes"></a>`,
    );

    expect(html).toBe('<a href="#kyomi-notes">Notes</a> <a>Missing</a> <a id="kyomi-notes"></a>');
  });

  test("keeps anchors within the 64-character limit", () => {
    const { html } = runPass("resolve-urls", `<h2 id="${"x".repeat(120)}">Long</h2>`);
    const id = html.match(/id="([^"]+)"/)?.[1] ?? "";

    expect(id.startsWith("kyomi-x")).toBe(true);
    expect(id.length).toBeLessThanOrEqual(64);
  });

  test("drops relative URLs when the article URL is unknown", () => {
    const { html } = runPass(
      "resolve-urls",
      `<a href="/about">About</a><img src="https://cdn.example/a.png" alt="">`,
      null,
    );

    expect(html).toBe('<a>About</a><img alt="" src="https://cdn.example/a.png">');
  });
});
