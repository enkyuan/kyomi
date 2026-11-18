import { normalizeSafeHttpUrl } from "@kyomi/reader/core";

/**
 * Navigation policy for the Expo DOM components (`*.dom.tsx`), which run in a WebView.
 *
 * `@expo/dom-webview` exposes no navigation hook (no `onShouldStartLoadWithRequest`) and its native
 * views allow every navigation, so a tapped link would load the publisher's page inside the reader,
 * next to the bridge that page could call. The component therefore claims every link click itself:
 * a web link goes to the host through an `openUrl` native action, which opens the system browser;
 * a link inside the document scrolls; anything else does nothing.
 */
export type LinkClick =
  | { readonly action: "scroll" }
  | { readonly action: "open"; readonly url: string }
  | { readonly action: "block" };

function withoutHash(url: string): string {
  const hash = url.indexOf("#");
  return hash === -1 ? url : url.slice(0, hash);
}

/** What a tap on `href` does, given the URL of the page that contains the link. */
export function resolveLinkClick(href: string, documentUrl: string): LinkClick {
  const raw = href.trim();

  try {
    const target = new URL(raw, documentUrl);
    if (target.hash && withoutHash(target.href) === withoutHash(documentUrl)) {
      return { action: "scroll" };
    }
  } catch {
    return { action: "block" };
  }

  const url = normalizeSafeHttpUrl(raw);
  return url ? { action: "open", url } : { action: "block" };
}

type ClickEvent = { readonly target: unknown; preventDefault(): void };
type Closest = {
  closest?: (selector: string) => { getAttribute(name: string): string | null } | null;
};

/** The tapped link: the target may be an element inside the anchor, or a text node in it. */
function linkOf(target: unknown): { getAttribute(name: string): string | null } | null {
  const node = target as (Closest & { parentElement?: Closest | null }) | null;
  const element = node?.closest ? node : node?.parentElement;
  return element?.closest?.("a[href], area[href]") ?? null;
}

/**
 * A capture-phase click handler for a DOM component's root. A click that is not on a link is left
 * alone; one on a link is always cancelled unless it scrolls inside the document.
 */
export function handleLinkClick(
  event: ClickEvent,
  openUrl: (url: string) => void,
  documentUrl: string,
): void {
  const href = linkOf(event.target)?.getAttribute("href");
  if (href == null) return;

  const click = resolveLinkClick(href, documentUrl);
  if (click.action === "scroll") return;

  event.preventDefault();
  if (click.action === "open") openUrl(click.url);
}

/**
 * Players are cross-origin pages, so the sandbox only has to keep them from acting on the island:
 * no top navigation (it would replace the island, bridge included), no new windows (a WebView
 * without multi-window support loads them in place), no forms or modals.
 */
export const EMBED_FRAME_SANDBOX = "allow-scripts allow-same-origin allow-presentation";

/** `frameUrl` when it is an https URL, otherwise null. The compiler only ever builds https players. */
export function httpsFrameUrl(frameUrl: string | undefined): string | null {
  const url = frameUrl ? normalizeSafeHttpUrl(frameUrl) : null;
  return url?.startsWith("https:") ? url : null;
}
