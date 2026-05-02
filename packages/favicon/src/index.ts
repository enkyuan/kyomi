export { assertSafeFaviconHost, ALLOWED_SCHEMES } from "./host-safety";
export {
  resolveFeedFaviconUrl,
  tryFetchImage,
  tryFetchImageIfHostSafe,
  findIconsFromHtml,
  findIconFromHtml,
  linkRelDeclaresSiteIcon,
  type FaviconResolutionSource,
  type ResolveFeedFaviconUrlResult,
} from "./resolve-favicon-url";
