export { buildFaviconUrlCandidates } from "@kyomi/worker/favicon/browser";

export function firstUsableFaviconIndex(urls: string[], rejectedUrls: ReadonlySet<string>): number {
  const index = urls.findIndex((url) => !rejectedUrls.has(url));
  return index >= 0 ? index : -1;
}

export function nextUsableFaviconIndex(
  urls: string[],
  currentUrl: string,
  rejectedUrls: ReadonlySet<string>,
): number {
  const currentIndex = urls.indexOf(currentUrl);
  const searchStart = currentIndex >= 0 ? currentIndex + 1 : 0;
  const nextIndex = urls
    .slice(searchStart)
    .findIndex((candidateUrl) => !rejectedUrls.has(candidateUrl));
  return nextIndex >= 0 ? searchStart + nextIndex : -1;
}
