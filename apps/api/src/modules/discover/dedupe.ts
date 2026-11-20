import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "./feed/normalize";
import type { FeedSearchResultDto } from "./types";

function normalizeSearchUrl(rawUrl: string | null | undefined): URL | null {
  if (!rawUrl) {
    return null;
  }
  try {
    return new URL(normalizeFeedUrl(assertHttpOrHttpsUrl(rawUrl).href));
  } catch {
    return null;
  }
}

function normalizeSearchText(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function getFeedSearchDedupeKeys(result: FeedSearchResultDto): string[] {
  const feedUrl = normalizeSearchUrl(result.url);
  const linkUrl = normalizeSearchUrl(result.link);
  const title = normalizeSearchText(result.title);
  const keys: string[] = [];

  if (feedUrl) {
    keys.push(`url:${feedUrl.href}`);
  }

  if (title) {
    const sourceUrl = linkUrl ?? feedUrl;
    if (sourceUrl) {
      keys.push(`source-title:${sourceUrl.origin}:${title}`);
    }
    if (linkUrl) {
      keys.push(`link-title:${linkUrl.href}:${title}`);
    }
  }

  return keys;
}

export function dedupeFeedSearchResults(
  results: FeedSearchResultDto[],
  limit: number,
): { items: FeedSearchResultDto[]; duplicateCount: number } {
  const items: FeedSearchResultDto[] = [];
  const indexByKey = new Map<string, number>();
  let duplicateCount = 0;

  for (const result of results) {
    const keys = getFeedSearchDedupeKeys(result);
    const existingIndex = keys
      .map((key) => indexByKey.get(key))
      .find((index): index is number => index !== undefined);

    if (existingIndex !== undefined) {
      duplicateCount += 1;
      if (result.isSubscribed && !items[existingIndex]?.isSubscribed) {
        items[existingIndex] = result;
      }
      continue;
    }

    const nextIndex = items.length;
    items.push(result);
    for (const key of keys) {
      indexByKey.set(key, nextIndex);
    }

    if (items.length >= limit) {
      break;
    }
  }

  return { items, duplicateCount };
}
