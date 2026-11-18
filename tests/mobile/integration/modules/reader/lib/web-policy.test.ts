// Value: protects=the navigation policy of the article WebViews: a web link opens outside the reader, a same-document link scrolls, and every other tap on a link is cancelled;
//   fails_when=a scheme trick (case, embedded newline, protocol-relative, relative path) reaches the host or lets the WebView load the link itself, or a legitimate footnote link stops scrolling;
//   why_new=the DOM components had no navigation policy, and Expo's WebView offers no hook to add one;
//   seam=pure functions over strings and a minimal click event, no DOM;
//   no_claim=green does not prove the component wires the handler (see the *.dom tests) or how a device WebView behaves.
import { describe, expect, mock, test } from "bun:test";
import {
  EMBED_FRAME_SANDBOX,
  handleLinkClick,
  httpsFrameUrl,
  resolveLinkClick,
} from "../../../../../../apps/mobile/src/modules/reader/lib/web-policy";

const DOCUMENT = "file:///var/app/dom/article.html";

describe("resolveLinkClick", () => {
  test.each([
    ["https://example.com/a?b=1#c", "https://example.com/a?b=1#c"],
    ["http://example.com/plain", "http://example.com/plain"],
    ["  https://example.com/padded  ", "https://example.com/padded"],
    ["HTTPS://Example.com/Upper", "https://example.com/Upper"],
    ["https://example.com/#section", "https://example.com/#section"],
  ])("opens the web link %p outside the reader", (href, url) => {
    expect(resolveLinkClick(href, DOCUMENT)).toEqual({ action: "open", url });
  });

  test.each([
    "javascript:alert(1)",
    " JaVaScRiPt:alert(1)",
    "java\nscript:alert(1)",
    "\tjavascript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "blob:https://example.com/1234",
    "file:///etc/hosts",
    "intent://scan/#Intent;scheme=zxing;end",
    "itms-services://?action=download-manifest&url=https://attacker.example/app.plist",
    "tel:+15555550100",
    "sms:+15555550100",
    "mailto:someone@example.com",
    "kyomi://settings",
    "//attacker.example/x",
    "/relative/path",
    "relative.html",
    "file:///var/app/dom/other.html#section",
    "#",
    "",
    "   ",
  ])("blocks %p", (href) => {
    expect(resolveLinkClick(href, DOCUMENT)).toEqual({ action: "block" });
  });

  test.each(["#note-1", "#kyomi-fn_1", "file:///var/app/dom/article.html#note-1"])(
    "lets the same-document link %p scroll",
    (href) => {
      expect(resolveLinkClick(href, DOCUMENT)).toEqual({ action: "scroll" });
    },
  );

  test("a same-document link keeps scrolling when the page is served over http (development)", () => {
    expect(resolveLinkClick("#note", "http://192.168.1.2:8081/_expo/dom/article.html")).toEqual({
      action: "scroll",
    });
    expect(
      resolveLinkClick(
        "http://192.168.1.2:8081/other#note",
        "http://192.168.1.2:8081/_expo/dom/a.html",
      ),
    ).toEqual({ action: "open", url: "http://192.168.1.2:8081/other#note" });
  });
});

describe("handleLinkClick", () => {
  const anchor = (href: string | null) => ({ getAttribute: () => href });
  const click = (link: { getAttribute(name: string): string | null } | null) => {
    const preventDefault = mock(() => undefined);
    const closest = mock((_selector: string) => link);
    return { closest, event: { preventDefault, target: { closest } }, preventDefault };
  };

  test("cancels the click and opens a web link in the host", () => {
    const openUrl = mock((_url: string) => undefined);
    const { event, preventDefault } = click(anchor("https://example.com/a"));

    handleLinkClick(event, openUrl, DOCUMENT);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(openUrl.mock.calls).toEqual([["https://example.com/a"]]);
  });

  test("cancels the click and tells the host nothing for another scheme", () => {
    const openUrl = mock((_url: string) => undefined);
    const { event, preventDefault } = click(anchor("javascript:alert(1)"));

    handleLinkClick(event, openUrl, DOCUMENT);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test("leaves a same-document link to scroll", () => {
    const openUrl = mock((_url: string) => undefined);
    const { event, preventDefault } = click(anchor("#note-1"));

    handleLinkClick(event, openUrl, DOCUMENT);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(openUrl).not.toHaveBeenCalled();
  });

  test("ignores a click that is not on a link", () => {
    const openUrl = mock((_url: string) => undefined);
    const { closest, event, preventDefault } = click(null);

    handleLinkClick(event, openUrl, DOCUMENT);

    expect(closest).toHaveBeenCalledWith("a[href], area[href]");
    expect(preventDefault).not.toHaveBeenCalled();
    expect(openUrl).not.toHaveBeenCalled();
  });

  test("finds the link from a text node, whose parent element is the tap target", () => {
    const openUrl = mock((_url: string) => undefined);
    const preventDefault = mock(() => undefined);
    const parent = { closest: () => anchor("https://example.com/text") };

    handleLinkClick({ preventDefault, target: { parentElement: parent } }, openUrl, DOCUMENT);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(openUrl.mock.calls).toEqual([["https://example.com/text"]]);
  });

  test("does nothing for a target that is not an element", () => {
    const openUrl = mock((_url: string) => undefined);
    const preventDefault = mock(() => undefined);

    handleLinkClick({ preventDefault, target: null }, openUrl, DOCUMENT);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(openUrl).not.toHaveBeenCalled();
  });
});

describe("embed frames", () => {
  test("accepts only an https frame URL", () => {
    expect(httpsFrameUrl("https://player.vimeo.com/video/76979871?dnt=1")).toBe(
      "https://player.vimeo.com/video/76979871?dnt=1",
    );
    for (const url of [
      undefined,
      "",
      "http://player.vimeo.com/video/1",
      "javascript:alert(1)",
      "data:text/html,x",
      "file:///etc/hosts",
      "//player.vimeo.com/video/1",
      "not a url",
    ]) {
      expect(httpsFrameUrl(url)).toBeNull();
    }
  });

  test("the sandbox grants no navigation, window, form or modal permission", () => {
    expect(EMBED_FRAME_SANDBOX.split(" ").sort()).toEqual([
      "allow-presentation",
      "allow-same-origin",
      "allow-scripts",
    ]);
  });
});
