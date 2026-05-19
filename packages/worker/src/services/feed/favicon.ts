import { resolveFeedFaviconUrl, tryFetchImageIfHostSafe } from "../favicon";

export async function tryResolveFaviconMetadata(
  seedUrl: string,
  embeddedIconUrl?: string | null,
): Promise<{
  url: string;
  source: string;
} | null> {
  try {
    const websiteIcon = await resolveFeedFaviconUrl(seedUrl);
    if (websiteIcon) {
      return websiteIcon;
    }
  } catch (error) {
    console.warn("[ingestion] favicon resolution failed", {
      seedUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!embeddedIconUrl) {
    return null;
  }
  try {
    const response = await tryFetchImageIfHostSafe(embeddedIconUrl);
    if (!response) {
      return null;
    }
    response.body?.cancel().catch(() => {});
    return { url: embeddedIconUrl, source: "feed_icon" };
  } catch (error) {
    console.warn("[ingestion] embedded favicon resolution failed", {
      iconUrl: embeddedIconUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
