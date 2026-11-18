import { Effect } from "effect";
import { XMLParser } from "fast-xml-parser";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "@modules/discover/feed/normalize";
import { BadRequest, PayloadTooLarge } from "@shared/effect/errors";
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

/**
 * The normalized URL, or the `BadRequest` to fail with. Returned instead of yielded so the
 * per-feed loop (up to OPML_MAX_FEEDS iterations) stays synchronous.
 */
function normalizeImportedFeedUrl(value: string): string | BadRequest {
  if (value.length > OPML_MAX_URL_LENGTH) {
    return new BadRequest({
      message: "Feed URL exceeds maximum length",
      code: "OPML_URL_TOO_LONG",
    });
  }
  try {
    return normalizeFeedUrl(assertHttpOrHttpsUrl(value).href);
  } catch {
    return new BadRequest({
      message: "OPML contains an invalid feed URL",
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
): BadRequest | null {
  const normalizedUrl = normalizeImportedFeedUrl(originalUrl);
  if (normalizedUrl instanceof BadRequest) {
    return normalizedUrl;
  }
  if (seen.has(normalizedUrl)) {
    return null;
  }
  seen.add(normalizedUrl);
  collected.push({ xmlUrl: originalUrl, originalUrl, normalizedUrl, title, folderName });
  if (collected.length > OPML_MAX_FEEDS) {
    return new BadRequest({
      message: "Too many feeds in OPML",
      code: "OPML_TOO_MANY",
      details: { max: OPML_MAX_FEEDS },
    });
  }
  return null;
}

const collectFeeds = Effect.fnUntraced(function* (root: OutlineNode[], fallbackFolderName: string) {
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
      const failure = registerFeed(originalUrl, title, folderName, seen, collected);
      if (failure) {
        return yield* failure;
      }
    }

    const children = asOutlineArray(node.outline);
    if (children.length === 0) {
      continue;
    }
    if (depth >= OPML_MAX_DEPTH) {
      return yield* new BadRequest({
        message: "OPML outline nesting is too deep",
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
});

const invalidDocument = () =>
  new BadRequest({ message: "Invalid OPML document", code: "OPML_INVALID" });

const noFeeds = () =>
  new BadRequest({ message: "No feed URLs found in OPML", code: "OPML_NO_FEEDS" });

/**
 * Admits a source before it is stored or parsed: a UTF-8 size ceiling, then no DTD or entity
 * declarations. Succeeds with the byte length.
 */
export const assertOpmlSourceAdmission = Effect.fnUntraced(function* (xml: string) {
  const byteLength = Buffer.byteLength(xml, "utf8");
  if (byteLength > OPML_MAX_SOURCE_BYTES) {
    return yield* new PayloadTooLarge({
      message: "OPML payload exceeds maximum size",
      code: "OPML_TOO_LARGE",
      details: { maxBytes: OPML_MAX_SOURCE_BYTES, foundBytes: byteLength },
    });
  }
  if (/(<!DOCTYPE|<!ENTITY)/i.test(xml)) {
    return yield* new BadRequest({
      message: "OPML document contains unsupported XML declarations",
      code: "OPML_UNSAFE_XML",
    });
  }
  return byteLength;
});

const parseOpmlXml = (xml: string) =>
  Effect.try({
    try: (): unknown =>
      new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        trimValues: true,
        processEntities: true,
      }).parse(xml),
    catch: (cause) =>
      new BadRequest({ message: "Could not parse OPML XML", code: "OPML_PARSE_FAILED", cause }),
  });

const getOpmlRoot = Effect.fnUntraced(function* (parsed: unknown) {
  const root =
    typeof parsed === "object" && parsed !== null ? (parsed as { opml?: unknown }).opml : null;
  if (typeof root !== "object" || root === null) {
    return yield* invalidDocument();
  }
  return root as Record<string, unknown>;
});

const getOpmlBody = Effect.fnUntraced(function* (root: Record<string, unknown>) {
  const body = root.body;
  if (body === undefined || body === null || body === "") {
    return yield* noFeeds();
  }
  if (typeof body !== "object") {
    return yield* invalidDocument();
  }
  return body as Record<string, unknown>;
});

/** Parses an OPML document into its distinct, normalized feed URLs grouped by folder name. */
export const parseOpmlDocument = Effect.fn("opml.parse")(function* (
  xml: string,
  fallbackFolderName = "Unsorted",
) {
  yield* assertOpmlSourceAdmission(xml);

  const parsed = yield* parseOpmlXml(xml);
  const root = yield* getOpmlRoot(parsed);
  const body = yield* getOpmlBody(root);
  const head =
    typeof root.head === "object" && root.head !== null ? (root.head as OutlineNode) : null;

  const feeds = yield* collectFeeds(asOutlineArray(body.outline), fallbackFolderName);
  if (feeds.length === 0) {
    return yield* noFeeds();
  }

  const document: ParsedOpmlDocument = {
    opmlTitle: head ? clampLabel(readString(head.title)) : null,
    opmlAuthor: head ? clampLabel(readString(head.ownerName) ?? readString(head.ownerEmail)) : null,
    feeds,
  };
  return document;
});
