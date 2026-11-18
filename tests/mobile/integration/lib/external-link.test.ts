// Value: protects=a link from an article opens only as a web page in the in-app browser or as an email in the mail app, whichever renderer it came from, and the WebView bridge cannot widen that;
//   fails_when=a deep link, tel:, file:, javascript: or a non-string reaches Linking or the browser, or a legitimate web or mailto link stops opening;
//   why_new=the host side of the openUrl bridge trusted the page that called it, and the native renderer trusted the compiler;
//   seam=the real helper with expo-linking and expo-web-browser stubbed;
//   no_claim=green does not prove the OS honours the URL or which browser UI appears.
import { afterEach, describe, expect, mock, test } from "bun:test";

const openURL = mock(async (_url: string) => true);
const openBrowserAsync = mock(async (_url: string) => ({ type: "opened" }));

mock.module("expo-linking", () => ({ openURL }));
mock.module("expo-web-browser", () => ({ openBrowserAsync }));

const { openExternalLink, resolveExternalLink } =
  await import("../../../../apps/mobile/src/lib/external-link");

afterEach(() => {
  openURL.mockClear();
  openBrowserAsync.mockClear();
});

describe("openExternalLink", () => {
  test.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "java\nscript:alert(1)",
    "file:///etc/hosts",
    "data:text/html,<script>alert(1)</script>",
    "itms-services://?action=download-manifest&url=https://attacker.example/app.plist",
    "intent://scan/#Intent;scheme=zxing;end",
    "tel:+15555550100",
    "sms:+15555550100",
    "kyomi://settings",
    "mailto:",
    "mailto: someone@example.com",
    "//attacker.example",
    "/relative",
    "",
  ])("opens nothing for %p", (url) => {
    openExternalLink(url);

    expect(openURL).not.toHaveBeenCalled();
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });

  test("opens nothing for a value that is not a string, as a page calling the bridge may send", () => {
    for (const value of [
      undefined,
      null,
      42,
      { href: "https://example.com" },
      ["https://example.com"],
    ]) {
      openExternalLink(value as unknown as string);
    }

    expect(openURL).not.toHaveBeenCalled();
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });

  test("opens a web link in the in-app browser", () => {
    openExternalLink("https://example.com/a?b=1#c");
    openExternalLink(" http://example.com/plain ");

    expect(openBrowserAsync.mock.calls).toEqual([
      ["https://example.com/a?b=1#c"],
      ["http://example.com/plain"],
    ]);
    expect(openURL).not.toHaveBeenCalled();
  });

  test("opens an email link in the mail app", () => {
    openExternalLink("mailto:editor@example.com?subject=Hello");

    expect(openURL.mock.calls).toEqual([["mailto:editor@example.com?subject=Hello"]]);
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });

  test("a launch that fails is not an unhandled rejection", async () => {
    openBrowserAsync.mockImplementationOnce(async () => {
      throw new Error("no browser");
    });
    openURL.mockImplementationOnce(async () => {
      throw new Error("no mail app");
    });

    openExternalLink("https://example.com/");
    openExternalLink("mailto:a@example.com");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(openBrowserAsync).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledTimes(1);
  });
});

describe("resolveExternalLink", () => {
  test("names where a link goes", () => {
    expect(resolveExternalLink("https://example.com/")).toEqual({
      kind: "browser",
      url: "https://example.com/",
    });
    expect(resolveExternalLink("mailto:a@example.com")).toEqual({
      kind: "mail",
      url: "mailto:a@example.com",
    });
    expect(resolveExternalLink("ftp://example.com/file")).toBeNull();
  });
});
