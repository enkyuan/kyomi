import { Effect } from "effect";
import type { HttpClient } from "effect/http";
import {
  type ImageNeed,
  IMAGE_HEADER_PROBE_BYTES,
  applyImageMeasurements,
  collectImagesToMeasure,
  computeThumbhash,
  readImageDimensions,
  type ImageMeasurement,
} from "@kyomi/ingest/enrichment";
import type { DocumentTarget } from "@kyomi/ingest";
import type { DatabaseError } from "@shared/effect/errors";
import { fetchBounded } from "./fetch";
import { EnrichmentGates, retryTransient, type RetryOptions } from "./limits";
import { DocumentPatchStore } from "./store";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 8_000;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/*;q=0.8";
const MAX_IMAGES_PER_JOB = 200;
const DEFAULT_CONCURRENCY = 4;

export type ImageMeasureOptions = {
  concurrency?: number;
  retry?: Partial<RetryOptions>;
};

export type ImageMeasureResult = {
  status: "patched" | "unchanged" | "missing" | "stale" | "invalid";
  requested: number;
  measured: number;
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** The measurement for one image, or null when it cannot be fetched or yields nothing. */
const probeImage = Effect.fn("articles.documentEnrichment.probeImage")(function* (
  probe: ImageNeed,
  retry: RetryOptions,
) {
  const host = hostOf(probe.url);
  if (host === null) {
    return null;
  }
  const gates = yield* EnrichmentGates;
  const fetched = yield* gates.images
    .run(
      host,
      fetchBounded(probe.url, {
        accept: IMAGE_ACCEPT,
        timeoutMs: IMAGE_TIMEOUT_MS,
        maxBytes: IMAGE_MAX_BYTES,
        contentType: /^image\//,
        // With a placeholder already stored only the header is needed; otherwise the whole
        // image is read, because a thumbhash needs decoded pixels.
        until: probe.needsPlaceholder
          ? undefined
          : (bytes) =>
              bytes.length >= IMAGE_HEADER_PROBE_BYTES || readImageDimensions(bytes) !== null,
      }).pipe(retryTransient(retry)),
    )
    // A resource that cannot be fetched is skipped; the image keeps rendering without it.
    .pipe(Effect.catchTag("EnrichmentFetchError", () => Effect.succeed(null)));
  if (fetched === null) {
    return null;
  }

  const { bytes, contentType } = fetched;
  const size = readImageDimensions(bytes);
  const measurement: ImageMeasurement = size ? { ...size } : {};
  // SVG is vector: no decode (and no SVG parser exposure) for a placeholder.
  if (probe.needsPlaceholder && contentType !== "image/svg+xml") {
    // Never throws: an image that cannot be decoded has no placeholder.
    const placeholder = yield* Effect.promise(() => computeThumbhash(bytes));
    if (placeholder) measurement.placeholder = placeholder;
  }
  return measurement.width !== undefined || measurement.placeholder !== undefined
    ? measurement
    : null;
});

/**
 * Fills missing `width`, `height`, and `placeholder` on a stored document's images. Idempotent:
 * only absent fields are written, a second run finds nothing to do, and a version conflict drops
 * the job (the compiler queues a fresh one for the new document).
 */
export const runImageMeasureJob = Effect.fn("articles.documentEnrichment.imageMeasure")(function* (
  target: DocumentTarget,
  options: ImageMeasureOptions = {},
): Effect.fn.Return<
  ImageMeasureResult,
  DatabaseError,
  DocumentPatchStore | EnrichmentGates | HttpClient.HttpClient
> {
  const store = yield* DocumentPatchStore;
  const retry: RetryOptions = { attempts: 3, baseDelayMs: 250, ...options.retry };
  const first = yield* store.load(target);
  if (!first) return { status: "missing", requested: 0, measured: 0 };

  const probes = collectImagesToMeasure(first.document).slice(0, MAX_IMAGES_PER_JOB);
  if (probes.length === 0) return { status: "unchanged", requested: 0, measured: 0 };

  const results = yield* Effect.forEach(probes, (probe) => probeImage(probe, retry), {
    concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
  });
  const measurements = new Map<string, ImageMeasurement>();
  results.forEach((result, index) => {
    if (result) measurements.set(probes[index]!.url, result);
  });
  if (measurements.size === 0) {
    return { status: "unchanged", requested: probes.length, measured: 0 };
  }

  const outcome = yield* store.patch(
    target,
    { documentVersion: first.documentVersion, compilerVersion: first.compilerVersion },
    (doc) => applyImageMeasurements(doc, measurements).document,
  );
  return { status: outcome.status, requested: probes.length, measured: measurements.size };
});
