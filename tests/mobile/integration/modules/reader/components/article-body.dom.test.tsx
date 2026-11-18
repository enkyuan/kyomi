// Value: protects=a link tapped in the DOM article body opens in the system browser instead of loading the publisher's page inside the reader's WebView;
//   fails_when=a link is left to navigate the WebView (which would then show an attacker page in the reader chrome with the bridge exposed), a non-web scheme reaches the host, or a footnote link stops scrolling;
//   why_new=the Android reader and the iOS fallback render every article link through this component and nothing tested what a tap does;
//   seam=the real component and the real article renderer in jsdom, with the native openUrl action stubbed;
//   no_claim=green does not prove the WebView's own navigation (iOS long-press menu, other load paths) or Custom Tabs on a device.
import { afterEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { createDomPage } from "../../../lib/dom-page";
import { mockMobileAuth, mockReactNative } from "../../../lib/module-mocks";

// React Native cannot load under bun.
mockReactNative();
mockMobileAuth();

const { default: ArticleBody } =
  await import("../../../../../../apps/mobile/src/modules/reader/components/article-body.dom");

const openUrl = mock((_url: string) => undefined);
let page: ReturnType<typeof createDomPage> | undefined;

async function mountArticle(contentHtml: string) {
  page = createDomPage();
  return page.mount(
    createElement(ArticleBody, {
      bottomInset: 0,
      colorScheme: "light",
      faviconUrls: [],
      feedTitle: "Feed",
      fontSizePx: 17,
      openUrl,
      reader: { bodyKind: "html", contentBaseUrl: "https://example.com/post", contentHtml },
      title: "Title",
    }),
  );
}

afterEach(async () => {
  openUrl.mockClear();
  await page?.cleanup();
  page = undefined;
});

describe("article body links", () => {
  test("hands a publisher link to the system browser and keeps the reader where it is", async () => {
    const root = await mountArticle(
      '<p>Read <a href="https://attacker.example/signin">this</a>.</p>',
    );

    const event = page!.click(root.querySelector(".article-body a")!);

    expect(event.defaultPrevented).toBe(true);
    expect(page!.navigations).toEqual([]);
    expect(openUrl.mock.calls).toEqual([["https://attacker.example/signin"]]);
  });

  test("a relative link is resolved against the article before it is opened", async () => {
    const root = await mountArticle('<p><a href="/archive/2026">archive</a></p>');

    page!.click(root.querySelector(".article-body a")!);

    expect(openUrl.mock.calls).toEqual([["https://example.com/archive/2026"]]);
  });

  test("never lets a link with another scheme navigate the reader or reach the host", async () => {
    const root = await mountArticle('<p><a href="https://example.com/">x</a></p>');
    const anchor = root.querySelector(".article-body a")!;

    for (const href of [
      "javascript:alert(1)",
      "file:///etc/hosts",
      "data:text/html,<script>alert(1)</script>",
      "itms-services://?action=download-manifest",
      "tel:+15555550100",
      "kyomi://settings",
    ]) {
      anchor.setAttribute("href", href);
      expect(page!.click(anchor).defaultPrevented).toBe(true);
    }

    expect(openUrl).not.toHaveBeenCalled();
    expect(page!.navigations).toEqual([]);
  });

  test("lets a footnote link scroll inside the article", async () => {
    const root = await mountArticle('<p><a href="#kyomi-fn1">1</a></p><p id="kyomi-fn1">Note</p>');

    const event = page!.click(root.querySelector(".article-body a")!);

    expect(event.defaultPrevented).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test("a tap on the title or body text is not a link", async () => {
    const root = await mountArticle("<p>Plain text</p>");

    expect(page!.click(root.querySelector("h1")!).defaultPrevented).toBe(false);
    expect(page!.click(root.querySelector(".article-body p")!).defaultPrevented).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });
});
