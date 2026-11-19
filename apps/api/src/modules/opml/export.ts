import { DateTime, Effect } from "effect";
import { eq } from "drizzle-orm";
import { feedSubscriptions, feeds, folders } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { decodeText } from "@shared/text/entities";

export type OpmlExportFeed = {
  title: string;
  xmlUrl: string;
  htmlUrl: string | null;
  folderName: string | null;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeExportTitle(title: string, xmlUrl: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : xmlUrl;
}

function normalizeFolderName(folderName: string | null): string | null {
  if (!folderName) {
    return null;
  }
  const trimmed = folderName.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareFolderNames(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return -1;
  }
  if (b === null) {
    return 1;
  }
  if (a === "Unsorted" && b !== "Unsorted") {
    return -1;
  }
  if (b === "Unsorted" && a !== "Unsorted") {
    return 1;
  }
  return compareStrings(a, b);
}

function compareFeeds(a: OpmlExportFeed, b: OpmlExportFeed): number {
  const folderOrder = compareFolderNames(a.folderName, b.folderName);
  if (folderOrder !== 0) {
    return folderOrder;
  }

  const titleOrder = compareStrings(a.title, b.title);
  if (titleOrder !== 0) {
    return titleOrder;
  }

  return compareStrings(a.xmlUrl, b.xmlUrl);
}

function renderFeedOutline(feed: OpmlExportFeed): string {
  const attrs = [
    `type="rss"`,
    `text="${escapeXml(feed.title)}"`,
    `title="${escapeXml(feed.title)}"`,
    `xmlUrl="${escapeXml(feed.xmlUrl)}"`,
  ];

  if (feed.htmlUrl) {
    attrs.push(`htmlUrl="${escapeXml(feed.htmlUrl)}"`);
  }

  return `<outline ${attrs.join(" ")}/>`;
}

export function buildOpmlExportDocument(
  feedsForExport: OpmlExportFeed[],
  options: { title?: string; generatedAt: Date },
): string {
  const normalizedFeeds = feedsForExport
    .map((feed) => ({
      title: normalizeExportTitle(feed.title, feed.xmlUrl),
      xmlUrl: feed.xmlUrl,
      htmlUrl: feed.htmlUrl,
      folderName: normalizeFolderName(feed.folderName),
    }))
    .sort(compareFeeds);

  const rootFeeds: string[] = [];
  const folderBuckets = new Map<string, string[]>();

  for (const feed of normalizedFeeds) {
    const outline = renderFeedOutline(feed);
    if (feed.folderName === null) {
      rootFeeds.push(outline);
      continue;
    }

    const bucket = folderBuckets.get(feed.folderName) ?? [];
    bucket.push(outline);
    folderBuckets.set(feed.folderName, bucket);
  }

  const folderSections = [...folderBuckets.entries()]
    .sort(([a], [b]) => compareFolderNames(a, b))
    .map(
      ([folderName, outlines]) =>
        `<outline text="${escapeXml(folderName)}" title="${escapeXml(folderName)}">${outlines.join("")}</outline>`,
    );

  const { generatedAt } = options;
  const title = options.title?.trim() || "kyomi Subscriptions";

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "<head>",
    `<title>${escapeXml(title)}</title>`,
    `<dateCreated>${escapeXml(generatedAt.toUTCString())}</dateCreated>`,
    `<dateModified>${escapeXml(generatedAt.toUTCString())}</dateModified>`,
    "</head>",
    `<body>${rootFeeds.join("")}${folderSections.join("")}</body>`,
    "</opml>",
  ].join("");
}

const listFeedsForOpmlExport = Effect.fn("opml.export.list_feeds")(function* (userId: string) {
  const db = yield* Db;
  const rows = yield* db.use("opml.export.list_feeds", (client) =>
    client
      .select({
        customTitle: feedSubscriptions.customTitle,
        feedTitle: feeds.title,
        xmlUrl: feeds.url,
        htmlUrl: feeds.link,
        folderName: folders.name,
      })
      .from(feedSubscriptions)
      .innerJoin(feeds, eq(feedSubscriptions.feedId, feeds.id))
      .leftJoin(folders, eq(feedSubscriptions.folderId, folders.id))
      .where(eq(feedSubscriptions.userId, userId)),
  );

  return rows.map(
    (row): OpmlExportFeed => ({
      title: decodeText((row.customTitle?.trim() || row.feedTitle).trim()),
      xmlUrl: row.xmlUrl,
      htmlUrl: row.htmlUrl,
      folderName: row.folderName,
    }),
  );
});

/** The OPML document for every feed the user is subscribed to. */
export const exportOpmlForUser = Effect.fn("opml.export")(function* (userId: string) {
  const feedsForExport = yield* listFeedsForOpmlExport(userId);
  const generatedAt = yield* DateTime.nowAsDate;
  return buildOpmlExportDocument(feedsForExport, { generatedAt });
});
