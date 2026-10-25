import {
  type ImageNeed,
  IMAGE_HEADER_PROBE_BYTES,
  applyImageMeasurements,
  collectImagesToMeasure,
  computeThumbhash,
  readImageDimensions,
  type ImageMeasurement,
} from "@kyomi/worker/enrichment";
import { fetchBounded } from "./fetch";
import { createKeyedGate, mapWithConcurrency, retryFetch, type RetryOptions } from "./limits";
import type { DocumentTarget } from "@kyomi/worker";
import type { DocumentPatchStore } from "./store";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 8_000;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/*;q=0.8";
const MAX_SAVE_ATTEMPTS = 3;
const MAX_IMAGES_PER_JOB = 200;

const hostGate = createKeyedGate(2);

export type ImageMeasureDeps = {
  store: DocumentPatchStore;
  concurrency?: number;
  retry?: Partial<RetryOptions>;
};

export type ImageMeasureResult = {
  status: "patched" | "unchanged" | "missing" | "stale" | "invalid";
  requested: number;
  measured: number;
};

async function probeImage(probe: ImageNeed, retry: RetryOptions): Promise<ImageMeasurement | null> {
  const fetched = await hostGate.run(new URL(probe.url).host, () =>
    retryFetch(
      () =>
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
        }),
      retry,
    ),
  );
  if (!fetched.ok) return null;

  const { bytes, contentType } = fetched.value;
  const size = readImageDimensions(bytes);
  const measurement: ImageMeasurement = size ? { ...size } : {};
  // SVG is vector: no decode (and no SVG parser exposure) for a placeholder.
  if (probe.needsPlaceholder && contentType !== "image/svg+xml") {
    const placeholder = await computeThumbhash(bytes);
    if (placeholder) measurement.placeholder = placeholder;
  }
  return measurement.width !== undefined || measurement.placeholder !== undefined
    ? measurement
    : null;
}

/**
 * Fills missing `width`, `height`, and `placeholder` on a stored document's images. Idempotent:
 * only absent fields are written, a second run finds nothing to do, and a version conflict re-runs
 * the merge against the fresh document without re-fetching.
 */
export async function runImageMeasureJob(
  target: DocumentTarget,
  deps: ImageMeasureDeps,
): Promise<ImageMeasureResult> {
  const retry: RetryOptions = { attempts: 3, baseDelayMs: 250, ...deps.retry };
  const first = await deps.store.load(target);
  if (!first) return { status: "missing", requested: 0, measured: 0 };

  const probes = collectImagesToMeasure(first.document).slice(0, MAX_IMAGES_PER_JOB);
  const urls = probes.map((probe) => probe.url);
  if (urls.length === 0) return { status: "unchanged", requested: 0, measured: 0 };

  const results = await mapWithConcurrency(probes, deps.concurrency ?? 4, (probe) =>
    probeImage(probe, retry),
  );
  const measurements = new Map<string, ImageMeasurement>();
  results.forEach((result, index) => {
    if (result) measurements.set(urls[index]!, result);
  });
  if (measurements.size === 0) return { status: "unchanged", requested: urls.length, measured: 0 };

  const outcome = await deps.store.patch(
    target,
    { documentVersion: first.documentVersion, compilerVersion: first.compilerVersion },
    (doc) => applyImageMeasurements(doc, measurements).document,
  );
  return { status: outcome.status, requested: urls.length, measured: measurements.size };
}
