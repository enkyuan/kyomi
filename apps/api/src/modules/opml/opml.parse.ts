import { XMLParser } from "fast-xml-parser";
import { AppError } from "@shared/errors/app-error";
import { OPML_MAX_BYTES, OPML_MAX_OUTLINES } from "./opml.constants";
import type { OpmlOutlineEntry } from "./opml.types";

function asOutlineArray(outline: unknown): Record<string, unknown>[] {
  if (outline === undefined || outline === null) {
    return [];
  }
  return (Array.isArray(outline) ? outline : [outline]) as Record<string, unknown>[];
}

function collectFromOutline(outline: Record<string, unknown>, out: OpmlOutlineEntry[]): void {
  const xmlUrl = outline.xmlUrl;
  if (typeof xmlUrl === "string" && xmlUrl.trim().length > 0) {
    out.push({
      xmlUrl: xmlUrl.trim(),
      title: typeof outline.text === "string" ? outline.text : undefined,
    });
  }
  const nested = outline.outline;
  for (const child of asOutlineArray(nested)) {
    if (typeof child === "object" && child !== null) {
      collectFromOutline(child as Record<string, unknown>, out);
    }
  }
}

function dedupeXmlUrls(entries: OpmlOutlineEntry[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const e of entries) {
    const key = e.xmlUrl.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    urls.push(e.xmlUrl);
  }
  return urls;
}

/**
 * Parse OPML 1.x/2.x body outlines and return deduped feed URLs (order preserved).
 */
export function parseOpmlFeeds(xml: string): string[] {
  if (xml.length > OPML_MAX_BYTES) {
    throw new AppError("OPML payload exceeds maximum size", {
      status: 413,
      code: "OPML_TOO_LARGE",
      details: { maxChars: OPML_MAX_BYTES },
    });
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new AppError("Could not parse OPML XML", { status: 400, code: "OPML_PARSE_FAILED" });
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new AppError("Invalid OPML document", { status: 400, code: "OPML_INVALID" });
  }

  const root = (parsed as Record<string, unknown>).opml;
  if (typeof root !== "object" || root === null) {
    throw new AppError("Invalid OPML document", { status: 400, code: "OPML_INVALID" });
  }

  const body = (root as Record<string, unknown>).body;
  if (body === undefined || body === null) {
    throw new AppError("Invalid OPML document", { status: 400, code: "OPML_INVALID" });
  }
  if (body === "") {
    throw new AppError("No feed URLs found in OPML", { status: 400, code: "OPML_NO_FEEDS" });
  }
  if (typeof body !== "object") {
    throw new AppError("Invalid OPML document", { status: 400, code: "OPML_INVALID" });
  }

  const collected: OpmlOutlineEntry[] = [];
  for (const o of asOutlineArray((body as Record<string, unknown>).outline)) {
    collectFromOutline(o, collected);
  }

  const urls = dedupeXmlUrls(collected);
  if (urls.length === 0) {
    throw new AppError("No feed URLs found in OPML", { status: 400, code: "OPML_NO_FEEDS" });
  }
  if (urls.length > OPML_MAX_OUTLINES) {
    throw new AppError("Too many feeds in OPML", {
      status: 400,
      code: "OPML_TOO_MANY",
      details: { max: OPML_MAX_OUTLINES, found: urls.length },
    });
  }

  return urls;
}
