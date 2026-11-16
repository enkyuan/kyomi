/**
 * The worker does not depend on `@kyomi/reader`, so these walkers are structural: they treat a
 * stored KDM document as JSON and match nodes by shape. The API validates the patched result
 * against `readerDocumentSchema` before saving.
 */
type KdmDocument = object;
type JsonObject = Record<string, unknown>;

export type ImageMeasurement = { width?: number; height?: number; placeholder?: string };

export type EmbedTarget = { provider: string; url: string };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** KDM images are the only nodes with both `src` and `alt` strings (`readerImageSchema`). */
function isImage(value: JsonObject): boolean {
  return typeof value.src === "string" && typeof value.alt === "string";
}

function isEmbed(value: JsonObject): boolean {
  return value.type === "embed" && typeof value.url === "string";
}

function visit(node: unknown, onNode: (node: JsonObject) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) visit(child, onNode);
    return;
  }
  if (!isObject(node)) return;
  onNode(node);
  for (const child of Object.values(node)) {
    if (typeof child === "object" && child !== null) visit(child, onNode);
  }
}

export function needsMeasurement(image: JsonObject): boolean {
  return image.width === undefined || image.height === undefined || image.placeholder === undefined;
}

export type ImageNeed = { url: string; needsSize: boolean; needsPlaceholder: boolean };

/** Distinct image URLs that still lack dimensions or a placeholder, with what each one lacks. */
export function collectImagesToMeasure(document: KdmDocument): ImageNeed[] {
  const needs = new Map<string, ImageNeed>();
  visit(document, (node) => {
    if (!isImage(node) || !needsMeasurement(node)) return;
    const url = node.src as string;
    const entry = needs.get(url) ?? { url, needsSize: false, needsPlaceholder: false };
    entry.needsSize ||= node.width === undefined || node.height === undefined;
    entry.needsPlaceholder ||= node.placeholder === undefined;
    needs.set(url, entry);
  });
  return [...needs.values()];
}

/**
 * Returns a copy of the document with measurements filled in. Existing values are never
 * overwritten, so applying the same measurements twice is a no-op.
 */
export function applyImageMeasurements<T extends KdmDocument>(
  document: T,
  measurements: ReadonlyMap<string, ImageMeasurement>,
): { document: T; changed: boolean } {
  const next = structuredClone(document);
  let changed = false;
  visit(next, (node) => {
    if (!isImage(node)) return;
    const measured = measurements.get(node.src as string);
    if (!measured) return;
    // Width and height travel together so an aspect ratio is never half-known.
    if (node.width === undefined && node.height === undefined) {
      if (measured.width !== undefined && measured.height !== undefined) {
        node.width = measured.width;
        node.height = measured.height;
        changed = true;
      }
    }
    if (node.placeholder === undefined && measured.placeholder !== undefined) {
      node.placeholder = measured.placeholder;
      changed = true;
    }
  });
  return { document: next, changed };
}

/** Embed blocks of the given providers that have no snapshot yet. */
export function collectEmbedsToSnapshot(
  document: KdmDocument,
  providers: ReadonlySet<string>,
): EmbedTarget[] {
  const found = new Map<string, EmbedTarget>();
  visit(document, (node) => {
    if (isEmbed(node) && providers.has(node.provider as string) && node.snapshot === undefined) {
      found.set(node.url as string, { provider: node.provider as string, url: node.url as string });
    }
  });
  return [...found.values()];
}

export function applyEmbedSnapshots<T extends KdmDocument>(
  document: T,
  snapshots: ReadonlyMap<string, unknown>,
): { document: T; changed: boolean } {
  const next = structuredClone(document);
  let changed = false;
  visit(next, (node) => {
    if (!isEmbed(node) || node.snapshot !== undefined) return;
    const snapshot = snapshots.get(node.url as string);
    if (snapshot) {
      node.snapshot = snapshot;
      changed = true;
    }
  });
  return { document: next, changed };
}
