import { absoluteHttpUrl } from "@kyomi/ingest/lib/feed-text";

/**
 * What the one-off URL repair decides about a stored row, without touching the database. Stored
 * values are judged by the helper the feed parser uses at ingest, so the repair and ingestion can
 * never disagree about what an acceptable URL is: http(s), and no username or password. A relative
 * value is resolved against the feed's own URL, as the parser resolves it.
 *
 * Nothing here returns, logs or throws a URL that may carry a login. A value is only ever replaced
 * by a URL the helper returned, or by null.
 */
const keeps = (value: string, feedUrl: string): boolean => absoluteHttpUrl(value, feedUrl) !== null;

export type FeedItemUrls = {
  link: string;
  imageUrl: string | null;
  feedUrl: string;
  feedLink: string | null;
};

export type FeedItemPlan = {
  /** Columns to write; empty when the row is fine. */
  patch: { link?: string; imageUrl?: null };
  /** The link is unacceptable and the feed offers no acceptable link or URL to put in its place. */
  linkUnrepairable: boolean;
};

/** The feed's site link, else its URL, as acceptable absolute URLs; null when neither is. */
function replacementLink(feedUrl: string, feedLink: string | null): string | null {
  return (
    (feedLink ? absoluteHttpUrl(feedLink, feedUrl) : null) ?? absoluteHttpUrl(feedUrl, feedUrl)
  );
}

export function planFeedItemRepair(row: FeedItemUrls): FeedItemPlan {
  const patch: FeedItemPlan["patch"] = {};
  let linkUnrepairable = false;
  // An empty link is left alone: the ingest upsert fills it from the item's next appearance, which
  // a feed-level link would prevent. A non-empty bad link is never overwritten by ingestion.
  if (row.link !== "" && !keeps(row.link, row.feedUrl)) {
    const replacement = replacementLink(row.feedUrl, row.feedLink);
    if (replacement === null) {
      linkUnrepairable = true;
    } else {
      patch.link = replacement;
    }
  }
  if (row.imageUrl !== null && !keeps(row.imageUrl, row.feedUrl)) {
    patch.imageUrl = null;
  }
  return { patch, linkUnrepairable };
}

export type FeedUrls = {
  url: string;
  link: string | null;
  siteUrl: string | null;
  canonicalFeedUrl: string | null;
  discoveredFromUrl: string | null;
  faviconUrl: string | null;
};

const FEED_LINK_COLUMNS = ["link", "siteUrl", "canonicalFeedUrl", "discoveredFromUrl"] as const;

export type FeedPatch = Partial<
  Record<(typeof FEED_LINK_COLUMNS)[number] | "faviconUrl" | "faviconSource", null>
>;

/** Why a feed's own URL is unacceptable. `host` is shown to the operator; it never has a login. */
export type UnsafeFeedUrl = {
  reason: "credentials" | "not_http" | "unparseable";
  host: string | null;
};

/**
 * Null when `url` is acceptable. Otherwise the reason and, for a URL that parses as http(s) but
 * carries a username or password, only its host (and port): the path and query can hold tokens
 * too, so they are never reported.
 */
export function describeUnsafeFeedUrl(url: string): UnsafeFeedUrl | null {
  if (keeps(url, url)) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { reason: "unparseable", host: null };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { reason: "not_http", host: null };
  }
  return { reason: "credentials", host: parsed.host };
}

export type FeedPlan = {
  /** Columns to set to null; empty when the row is fine. */
  patch: FeedPatch;
  linksCleared: boolean;
  faviconCleared: boolean;
  /** The feed's own `url` is unacceptable. It is reported, never rewritten. */
  unsafeUrl: UnsafeFeedUrl | null;
};

export function planFeedRepair(row: FeedUrls): FeedPlan {
  const patch: FeedPatch = {};
  let linksCleared = false;
  for (const column of FEED_LINK_COLUMNS) {
    const value = row[column];
    if (value !== null && !keeps(value, row.url)) {
      patch[column] = null;
      linksCleared = true;
    }
  }
  // Clearing the icon (and how it was resolved) makes the next refresh resolve it again.
  const faviconCleared = row.faviconUrl !== null && !keeps(row.faviconUrl, row.url);
  if (faviconCleared) {
    patch.faviconUrl = null;
    patch.faviconSource = null;
  }
  return { patch, linksCleared, faviconCleared, unsafeUrl: describeUnsafeFeedUrl(row.url) };
}
