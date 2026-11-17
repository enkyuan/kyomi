import { Effect } from "effect";
import type { HttpClient } from "effect/http";
import {
  SNAPSHOT_PROVIDERS,
  applyEmbedSnapshots,
  collectEmbedsToSnapshot,
  isSnapshotProvider,
  parseSnapshot,
  snapshotRequest,
  type EmbedSnapshot,
} from "@kyomi/ingest/enrichment";
import type { DocumentTarget } from "@kyomi/ingest";
import { currentDate } from "@modules/articles/clock";
import type { DatabaseError } from "@shared/effect/errors";
import { fetchBounded } from "./fetch";
import { EnrichmentGates, retryTransient, type RetryOptions } from "./limits";
import { DocumentPatchStore } from "./store";

const SNAPSHOT_MAX_BYTES = 1024 * 1024;
const SNAPSHOT_TIMEOUT_MS = 8_000;
const MAX_EMBEDS_PER_JOB = 20;
const DEFAULT_CONCURRENCY = 3;

const providers: ReadonlySet<string> = new Set(SNAPSHOT_PROVIDERS);

export type EmbedSnapshotOptions = {
  concurrency?: number;
  retry?: Partial<RetryOptions>;
};

export type EmbedSnapshotResult = {
  status: "patched" | "unchanged" | "missing" | "stale" | "invalid";
  requested: number;
  fetched: number;
};

/** The snapshot for one embed, or null when it cannot be fetched or parsed. */
const snapshotEmbed = Effect.fn("articles.documentEnrichment.snapshotEmbed")(function* (
  embed: { provider: string; url: string },
  retry: RetryOptions,
) {
  if (!isSnapshotProvider(embed.provider)) return null;
  const request = snapshotRequest(embed.provider, embed.url);
  if (!request) return null;
  const gates = yield* EnrichmentGates;
  const fetched = yield* gates.embeds
    .run(
      new URL(request.url).host,
      fetchBounded(request.url, {
        accept: request.accept,
        timeoutMs: SNAPSHOT_TIMEOUT_MS,
        maxBytes: SNAPSHOT_MAX_BYTES,
      }).pipe(retryTransient(retry)),
    )
    // A failed fetch leaves the embed as it was; the block keeps its link-card fallback.
    .pipe(Effect.catchTag("EnrichmentFetchError", () => Effect.succeed(null)));
  if (fetched === null) return null;
  const fetchedAt = (yield* currentDate).toISOString();
  return parseSnapshot(embed.provider, new TextDecoder().decode(fetched.bytes), fetchedAt);
});

/**
 * Writes `embed.snapshot` for supported providers. A failed fetch or unparseable response leaves
 * the embed as it was; the block keeps rendering its link-card fallback.
 */
export const runEmbedSnapshotJob = Effect.fn("articles.documentEnrichment.embedSnapshot")(
  function* (
    target: DocumentTarget,
    options: EmbedSnapshotOptions = {},
  ): Effect.fn.Return<
    EmbedSnapshotResult,
    DatabaseError,
    DocumentPatchStore | EnrichmentGates | HttpClient.HttpClient
  > {
    const store = yield* DocumentPatchStore;
    const retry: RetryOptions = { attempts: 3, baseDelayMs: 500, ...options.retry };
    const first = yield* store.load(target);
    if (!first) return { status: "missing", requested: 0, fetched: 0 };

    const embeds = collectEmbedsToSnapshot(first.document, providers).slice(0, MAX_EMBEDS_PER_JOB);
    if (embeds.length === 0) return { status: "unchanged", requested: 0, fetched: 0 };

    const results = yield* Effect.forEach(embeds, (embed) => snapshotEmbed(embed, retry), {
      concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    });
    const snapshots = new Map<string, EmbedSnapshot>();
    results.forEach((snapshot, index) => {
      if (snapshot) snapshots.set(embeds[index]!.url, snapshot);
    });
    if (snapshots.size === 0) {
      return { status: "unchanged", requested: embeds.length, fetched: 0 };
    }

    const outcome = yield* store.patch(
      target,
      { documentVersion: first.documentVersion, compilerVersion: first.compilerVersion },
      (doc) => applyEmbedSnapshots(doc, snapshots).document,
    );
    return { status: outcome.status, requested: embeds.length, fetched: snapshots.size };
  },
);
