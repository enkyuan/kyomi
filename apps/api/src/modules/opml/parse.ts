import { XMLParser } from "fast-xml-parser";
import { AppError } from "@shared/errors/app";
import { decodeText } from "@shared/text/entities";
import { OPML_MAX_BYTES, OPML_MAX_OUTLINES } from "./constants";
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

function readOutlineLabel(outline: OutlineNode): string | null {
  return readString(outline.text) ?? readString(outline.title);
}

function collectFeeds(
  outline: OutlineNode,
  ancestors: string[],
  fallbackFolderName: string,
  out: ParsedOpmlFeed[],
): void {
  const xmlUrl = readString(outline.xmlUrl);
  const title = readOutlineLabel(outline);

  if (xmlUrl) {
    out.push({
      xmlUrl,
      title,
      folderName: ancestors[ancestors.length - 1] ?? fallbackFolderName,
    });
  }

  const nextAncestors = title ? [...ancestors, title] : ancestors;
  for (const child of asOutlineArray(outline.outline)) {
    collectFeeds(child, nextAncestors, fallbackFolderName, out);
  }
}

function dedupeFeeds(feeds: ParsedOpmlFeed[]): ParsedOpmlFeed[] {
  const seen = new Set<string>();
  const deduped: ParsedOpmlFeed[] = [];

  for (const feed of feeds) {
    const key = feed.xmlUrl.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(feed);
  }

  return deduped;
}

function assertWithinSizeLimit(xml: string): void {
  if (xml.length <= OPML_MAX_BYTES) {
    return;
  }
  throw new AppError("OPML payload exceeds maximum size", {
    status: 413,
    code: "OPML_TOO_LARGE",
    details: { maxChars: OPML_MAX_BYTES },
  });
}

function assertNoDangerousDeclarations(xml: string): void {
  if (!/(<!DOCTYPE|<!ENTITY)/i.test(xml)) {
    return;
  }
  throw new AppError("OPML document contains unsupported XML declarations", {
    status: 400,
    code: "OPML_UNSAFE_XML",
  });
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

function assertOutlineCountLimit(count: number): void {
  if (count <= OPML_MAX_OUTLINES) {
    return;
  }
  throw new AppError("Too many feeds in OPML", {
    status: 400,
    code: "OPML_TOO_MANY",
    details: { max: OPML_MAX_OUTLINES, found: count },
  });
}

export function parseOpmlDocument(
  xml: string,
  fallbackFolderName = "Unsorted",
): ParsedOpmlDocument {
  assertWithinSizeLimit(xml);
  assertNoDangerousDeclarations(xml);

  const parsed = parseOpmlXml(xml);
  const root = getOpmlRoot(parsed);
  const body = getOpmlBody(root);
  const head =
    typeof root.head === "object" && root.head !== null ? (root.head as OutlineNode) : null;

  const collected: ParsedOpmlFeed[] = [];
  for (const outline of asOutlineArray(body.outline)) {
    collectFeeds(outline, [], fallbackFolderName, collected);
  }

  const feeds = dedupeFeeds(collected);
  if (feeds.length === 0) {
    throw new AppError("No feed URLs found in OPML", { status: 400, code: "OPML_NO_FEEDS" });
  }
  assertOutlineCountLimit(feeds.length);

  return {
    opmlTitle: head ? readString(head.title) : null,
    opmlAuthor: head ? (readString(head.ownerName) ?? readString(head.ownerEmail)) : null,
    feeds,
  };
}

/**
 * Backwards-compatible helper used by existing tests and any URL-only callers.
 */
export function parseOpmlFeeds(xml: string): string[] {
  return parseOpmlDocument(xml).feeds.map((feed) => feed.xmlUrl);
}
