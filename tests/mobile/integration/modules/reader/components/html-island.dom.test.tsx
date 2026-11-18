// Value: protects=a link tapped inside an html island opens in the system browser instead of loading inside the reader's WebView, and an embed frame is limited to https and sandboxed;
//   fails_when=a publisher link replaces the island (and the bridge it can call) with a remote page, a non-web scheme reaches the host, or a frame can navigate the island or open windows;
//   why_new=Expo's WebView has no navigation policy, so the click handler in the DOM component is the only control and nothing tested it;
//   seam=the real component rendered in jsdom, with the native openUrl action stubbed;
//   no_claim=green does not prove the WebView stops other navigations (iOS long-press menu) or that Custom Tabs opens on a device.
import { afterEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { createDomPage } from "../../../lib/dom-page";

const { default: HtmlIsland } =
  await import("../../../../../../apps/mobile/src/modules/reader/components/html-island.dom");

const openUrl = mock((_url: string) => undefined);
let page: ReturnType<typeof createDomPage> | undefined;

async function mountHtml(html: string) {
  page = createDomPage();
  return page.mount(
    createElement(HtmlIsland, {
      colorScheme: "light",
      fontSizePx: 17,
      html,
      kind: "html",
      openUrl,
      title: "Island",
    }),
  );
}

afterEach(async () => {
  openUrl.mockClear();
  await page?.cleanup();
  page = undefined;
});

describe("html island links", () => {
  test("hands a publisher link to the system browser and keeps the island where it is", async () => {
    const root = await mountHtml('<p><a href="https://attacker.example/signin">Sign in</a></p>');

    const event = page!.click(root.querySelector("a")!);

    expect(event.defaultPrevented).toBe(true);
    expect(page!.navigations).toEqual([]);
    expect(openUrl.mock.calls).toEqual([["https://attacker.example/signin"]]);
  });

  test("handles a tap on an element inside the link", async () => {
    const root = await mountHtml(
      '<a href="https://example.com/post"><strong>Read <em>on</em></strong></a>',
    );

    const event = page!.click(root.querySelector("em")!);

    expect(event.defaultPrevented).toBe(true);
    expect(openUrl.mock.calls).toEqual([["https://example.com/post"]]);
  });

  test("a link that asks for a new window is handled the same way", async () => {
    const root = await mountHtml('<a href="https://example.com/out" target="_blank">out</a>');

    const event = page!.click(root.querySelector("a")!);

    expect(event.defaultPrevented).toBe(true);
    expect(page!.navigations).toEqual([]);
    expect(openUrl.mock.calls).toEqual([["https://example.com/out"]]);
  });

  test("never passes a non-web scheme to the host and never navigates to it", async () => {
    // The sanitizer already drops most of these; the click policy must hold even for one it misses.
    const root = await mountHtml('<p><a id="x" href="https://example.com/">x</a></p>');
    const anchor = root.querySelector("a")!;

    for (const href of [
      "javascript:alert(1)",
      "file:///etc/hosts",
      "data:text/html,<script>alert(1)</script>",
      "intent://scan/#Intent;scheme=zxing;end",
      "itms-services://?action=download-manifest",
      "tel:+15555550100",
      "kyomi://settings",
    ]) {
      anchor.setAttribute("href", href);
      const event = page!.click(anchor);
      expect(event.defaultPrevented).toBe(true);
    }

    expect(openUrl).not.toHaveBeenCalled();
    expect(page!.navigations).toEqual([]);
  });

  test("lets a link inside the same document scroll", async () => {
    const root = await mountHtml('<p><a href="#note-1">1</a></p><p id="note-1">Note</p>');

    const event = page!.click(root.querySelector("a")!);

    expect(event.defaultPrevented).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test("ignores a tap that is not on a link", async () => {
    const root = await mountHtml("<p>No links here</p>");

    const event = page!.click(root.querySelector("p")!);

    expect(event.defaultPrevented).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });
});

describe("html island embed frame", () => {
  async function mountEmbed(frameUrl: string) {
    page = createDomPage();
    return page.mount(
      createElement(HtmlIsland, {
        colorScheme: "light",
        fontSizePx: 17,
        frameUrl,
        kind: "embed",
        openUrl,
        title: "YouTube",
      }),
    );
  }

  test("renders the player in a sandbox that cannot navigate the island or open windows", async () => {
    const root = await mountEmbed("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    const frame = root.querySelector("iframe");

    expect(frame?.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    const tokens = (frame?.getAttribute("sandbox") ?? "").split(/\s+/);
    expect(tokens).toContain("allow-scripts");
    expect(tokens).toContain("allow-same-origin");
    for (const forbidden of [
      "allow-top-navigation",
      "allow-top-navigation-by-user-activation",
      "allow-popups",
      "allow-popups-to-escape-sandbox",
      "allow-forms",
      "allow-modals",
    ]) {
      expect(tokens).not.toContain(forbidden);
    }
  });

  test.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/hosts",
    "http://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "//attacker.example/embed",
    "not a url",
  ])("renders no frame for %p", async (frameUrl) => {
    const root = await mountEmbed(frameUrl);

    expect(root.querySelector("iframe")).toBeNull();
  });
});
