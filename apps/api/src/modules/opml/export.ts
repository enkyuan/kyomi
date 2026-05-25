import { and, eq } from "drizzle-orm";
import type { db } from "@adapters/db/client";
import { feedSubscriptions, feeds, folders } from "@vols.rss/db";
import { decodeText } from "@shared/text/entities";

type DB = typeof db;

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
  options?: { title?: string; generatedAt?: Date },
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

  const generatedAt = options?.generatedAt ?? new Date();
  const title = options?.title?.trim() || "vols.rss Subscriptions";

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

export async function listFeedsForOpmlExport(
  database: DB,
  userId: string,
): Promise<OpmlExportFeed[]> {
  const rows = await database
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
    .where(eq(feedSubscriptions.userId, userId));

  return rows.map((row) => ({
    title: decodeText((row.customTitle?.trim() || row.feedTitle).trim()),
    xmlUrl: row.xmlUrl,
    htmlUrl: row.htmlUrl,
    folderName: row.folderName,
  }));
}

export async function exportOpmlForUser(
  database: DB,
  userId: string,
  options?: { generatedAt?: Date },
): Promise<string> {
  const feeds = await listFeedsForOpmlExport(database, userId);
  return buildOpmlExportDocument(feeds, options);
}
