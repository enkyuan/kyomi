import { assertSafeFaviconHost } from "./host-safety";
import { tryFetchImage, tryFetchImageIfHostSafe } from "./fetch-image";
import { findIconHrefFromHtml } from "./html-icon";

export type FaviconResolutionSource =
  | "favicon_ico"
  | "asset_path"
  | "html"
  | "google"
  | "duckduckgo";

export type FaviconResolution = {
  url: string;
  source: FaviconResolutionSource;
};

const COMMON_ICON_PATHS = [
  "/favicon.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/favicon-196x196.png",
];

/**
 * Resolve a best-effort favicon image URL for a site, using the same strategy as the
 * `/api/favicon` proxy (direct paths → HTML `<link>` → Google → DuckDuckGo).
 *
 * @param rawHttpUrl Any absolute `http`/`https` URL for the site or feed; origin is used.
 */
export async function resolveFaviconUrlFromHttpUrl(
  rawHttpUrl: string,
): Promise<FaviconResolution | null> {
  let origin: string;
  let hostname: string;
  try {
    const parsed = new URL(rawHttpUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    origin = parsed.origin;
    hostname = parsed.hostname;
  } catch {
    return null;
  }

  const hostOk = await assertSafeFaviconHost(hostname);
  if (!hostOk) {
    return null;
  }

  const directIco = await tryFetchImage(`${origin}/favicon.ico`);
  if (directIco) {
    directIco.body?.cancel().catch(() => {});
    return { url: `${origin}/favicon.ico`, source: "favicon_ico" };
  }

  for (const path of COMMON_ICON_PATHS) {
    const candidate = `${origin}${path}`;
    const result = await tryFetchImage(candidate);
    if (result) {
      result.body?.cancel().catch(() => {});
      return { url: candidate, source: "asset_path" };
    }
  }

  const iconHref = await findIconHrefFromHtml(origin);
  if (iconHref) {
    const htmlIcon = await tryFetchImageIfHostSafe(iconHref);
    if (htmlIcon) {
      htmlIcon.body?.cancel().catch(() => {});
      return { url: iconHref, source: "html" };
    }
  }

  const googleUrl = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origin)}&sz=64`;
  const googleResult = await tryFetchImageIfHostSafe(googleUrl);
  if (googleResult) {
    googleResult.body?.cancel().catch(() => {});
    return { url: googleUrl, source: "google" };
  }

  const duckUrl = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  const duckResult = await tryFetchImageIfHostSafe(duckUrl);
  if (duckResult) {
    duckResult.body?.cancel().catch(() => {});
    return { url: duckUrl, source: "duckduckgo" };
  }

  return null;
}
