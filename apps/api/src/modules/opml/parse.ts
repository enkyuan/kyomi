import { XMLParser } from "fast-xml-parser";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "@modules/discover/feed/normalize";
import { AppError } from "@shared/errors/app";
import { decodeText } from "@shared/text/entities";
import {
  OPML_MAX_DEPTH,
  OPML_MAX_FEEDS,
  OPML_MAX_LABEL_LENGTH,
  OPML_MAX_SOURCE_BYTES,
  OPML_MAX_URL_LENGTH,
} from "./constants";
import type { ParsedOpmlDocument, ParsedOpmlFeed } from "./types";

type OutlineNode = Record<string, unknown>;

function asOutlineArray(outline: unknown): OutlineNode[] {
  if (outline === undefined || outline === null) {
    return [];
  }
  return (Array.isArray(outline) ? outline : [outline]).filter(
    (item): item is OutlineNode => typeof item === "object" && item !== null,
  );
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = decodeText(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampLabel(value: string | null): string | null {
  return value === null ? null : value.slice(0, OPML_MAX_LABEL_LENGTH);
}

function readOutlineLabel(outline: OutlineNode): string | null {
  return clampLabel(readString(outline.text) ?? readString(outline.title));
}

function normalizeImportedFeedUrl(value: string): string {
  if (value.length > OPML_MAX_URL_LENGTH) {
    throw new AppError("Feed URL exceeds maximum length", {
      status: 400,
      code: "OPML_URL_TOO_LONG",
    });
  }
  try {
    return normalizeFeedUrl(assertHttpOrHttpsUrl(value).href);
  } catch {
    throw new AppError("OPML contains an invalid feed URL", {
      status: 400,
      code: "OPML_FEED_URL_INVALID",
    });
  }
}

type TraversalFrame = {
  node: OutlineNode;
  ancestors: string[];
  depth: number;
};

function registerFeed(
  originalUrl: string,
  title: string | null,
  folderName: string,
  seen: Set<string>,
  collected: ParsedOpmlFeed[],
): void {
  const normalizedUrl = normalizeImportedFeedUrl(originalUrl);
  if (seen.has(normalizedUrl)) {
    return;
  }
  seen.add(normalizedUrl);
  collected.push({ xmlUrl: originalUrl, originalUrl, normalizedUrl, title, folderName });
  if (collected.length > OPML_MAX_FEEDS) {
    throw new AppError("Too many feeds in OPML", {
      status: 400,
      code: "OPML_TOO_MANY",
      details: { max: OPML_MAX_FEEDS },
    });
  }
}

function collectFeeds(root: OutlineNode[], fallbackFolderName: string): ParsedOpmlFeed[] {
  const collected: ParsedOpmlFeed[] = [];
  const seen = new Set<string>();
  const stack: TraversalFrame[] = root
    .map((node) => ({ node, ancestors: [] as string[], depth: 0 }))
    .reverse();

  let frame: TraversalFrame | undefined;
  while ((frame = stack.pop())) {
    const { node, ancestors, depth } = frame;

    const originalUrl = readString(node.xmlUrl);
    const title = readOutlineLabel(node);
    const folderName = ancestors[ancestors.length - 1] ?? fallbackFolderName;
    if (originalUrl) {
      registerFeed(originalUrl, title, folderName, seen, collected);
    }

    const children = asOutlineArray(node.outline);
    if (children.length === 0) {
      continue;
    }
    if (depth >= OPML_MAX_DEPTH) {
      throw new AppError("OPML outline nesting is too deep", {
        status: 400,
        code: "OPML_TOO_DEEP",
        details: { maxDepth: OPML_MAX_DEPTH },
      });
    }
    const nextAncestors = title ? [...ancestors, title] : ancestors;
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push({ node: children[i] as OutlineNode, ancestors: nextAncestors, depth: depth + 1 });
    }
  }

  return collected;
}

export function assertOpmlSourceAdmission(xml: string): number {
  const byteLength = Buffer.byteLength(xml, "utf8");
  if (byteLength > OPML_MAX_SOURCE_BYTES) {
    throw new AppError("OPML payload exceeds maximum size", {
      status: 413,
      code: "OPML_TOO_LARGE",
      details: { maxBytes: OPML_MAX_SOURCE_BYTES, foundBytes: byteLength },
    });
  }
  if (/(<!DOCTYPE|<!ENTITY)/i.test(xml)) {
    throw new AppError("OPML document contains unsupported XML declarations", {
      status: 400,
      code: "OPML_UNSAFE_XML",
    });
  }
  return byteLength;
}

function parseOpmlXml(xml: string): unknown {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    processEntities: true,
  });
  try {
    return parser.parse(xml);
  } catch {
    throw new AppError("Could not parse OPML XML", { status: 400, code: "OPML_PARSE_FAILED" });
  }
}

function getOpmlRoot(parsed: unknown): Record<string, unknown> {
  if (typeof parsed !== "object" || parsed === null) {
    throw new AppError("Invalid OPML document", { status: 400, code: "OPML_INVALID" });
  }
  const root = (parsed as Record<string, unknown>).opml;
  if (typeof root !== "object" || root === null) {
    throw new AppError("Invalid OPML document", { status: 400, code: "OPML_INVALID" });
  }
  return root as Record<string, unknown>;
}

function getOpmlBody(root: Record<string, unknown>): Record<string, unknown> {
  const body = root.body;
  if (body === undefined || body === null || body === "") {
    throw new AppError("No feed URLs found in OPML", { status: 400, code: "OPML_NO_FEEDS" });
  }
  if (typeof body !== "object") {
    throw new AppError("Invalid OPML document", { status: 400, code: "OPML_INVALID" });
  }
  return body as Record<string, unknown>;
}

export function parseOpmlDocument(
  xml: string,
  fallbackFolderName = "Unsorted",
): ParsedOpmlDocument {
  assertOpmlSourceAdmission(xml);

  const parsed = parseOpmlXml(xml);
  const root = getOpmlRoot(parsed);
  const body = getOpmlBody(root);
  const head =
    typeof root.head === "object" && root.head !== null ? (root.head as OutlineNode) : null;

  const feeds = collectFeeds(asOutlineArray(body.outline), fallbackFolderName);
  if (feeds.length === 0) {
    throw new AppError("No feed URLs found in OPML", { status: 400, code: "OPML_NO_FEEDS" });
  }

  return {
    opmlTitle: head ? clampLabel(readString(head.title)) : null,
    opmlAuthor: head ? clampLabel(readString(head.ownerName) ?? readString(head.ownerEmail)) : null,
    feeds,
  };
}

/**
 * Backwards-compatible helper used by existing tests and any URL-only callers.
 */
export function parseOpmlFeeds(xml: string): string[] {
  return parseOpmlDocument(xml).feeds.map((feed) => feed.xmlUrl);
}
