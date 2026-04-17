export { ALLOWED_SCHEMES, assertSafeFaviconHost, canonicalHostname } from "./host-safety";
export { tryFetchImage, tryFetchImageIfHostSafe } from "./fetch-image";
export { findIconHrefFromHtml } from "./html-icon";
export {
  resolveFaviconUrlFromHttpUrl,
  type FaviconResolution,
  type FaviconResolutionSource,
} from "./resolve-favicon-url";
export { normalizeHttpUrlComparable, pickHttpUrlForFaviconResolution } from "./url-helpers";
