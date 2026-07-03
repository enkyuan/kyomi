import type { FollowedFeed } from "@modules/feeds/api";
import type { RecapFolder } from "../../types";

function escapeXmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getOpmlFilename(folderName: string) {
  const slug = folderName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `kyomi-${slug || "folder"}-subscriptions.opml`;
}

export function downloadSelectedOpml(folder: RecapFolder, feeds: FollowedFeed[]) {
  const folderTitle = escapeXmlAttribute(folder.name);
  const outlines = feeds
    .map((feed) => {
      const title = escapeXmlAttribute(feed.title || feed.url);
      const xmlUrl = escapeXmlAttribute(feed.url);
      const htmlUrl = feed.link ? ` htmlUrl="${escapeXmlAttribute(feed.link)}"` : "";
      return `    <outline text="${title}" title="${title}" type="rss" xmlUrl="${xmlUrl}"${htmlUrl} />`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>Kyomi ${folderTitle}</title>\n  </head>\n  <body>\n    <outline text="${folderTitle}" title="${folderTitle}">\n${outlines}\n    </outline>\n  </body>\n</opml>\n`;
  const url = URL.createObjectURL(new Blob([xml], { type: "application/xml;charset=utf-8" }));
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = getOpmlFilename(folder.name);
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
