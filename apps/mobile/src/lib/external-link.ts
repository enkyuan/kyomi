import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { normalizeSafeHttpUrl } from "@kyomi/reader/core";

/**
 * Where a link tapped inside an article may go: a web page opens in the in-app browser, and an
 * email address in the mail app. Any other scheme (another app's deep link, `tel:`, `file:`,
 * `javascript:`) is refused, whichever renderer the link came from. The caller may be a WebView
 * page through the Expo DOM bridge, so the argument is checked, not trusted to be a string.
 */
export function resolveExternalLink(
  raw: string,
): { readonly kind: "browser" | "mail"; readonly url: string } | null {
  if (typeof raw !== "string") return null;

  const url = normalizeSafeHttpUrl(raw);
  if (url) return { kind: "browser", url };

  const mail = raw.trim();
  return /^mailto:[^\s]+$/i.test(mail) ? { kind: "mail", url: mail } : null;
}

export function openExternalLink(raw: string): void {
  const link = resolveExternalLink(raw);
  if (!link) return;

  if (link.kind === "mail") void Linking.openURL(link.url).catch(() => undefined);
  else void WebBrowser.openBrowserAsync(link.url).catch(() => undefined);
}
