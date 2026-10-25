import {
  SNAPSHOT_PROVIDERS,
  applyEmbedSnapshots,
  collectEmbedsToSnapshot,
  isSnapshotProvider,
  parseSnapshot,
  snapshotRequest,
  type EmbedSnapshot,
} from "@kyomi/worker/enrichment";
import { fetchBounded } from "./fetch";
import { createKeyedGate, mapWithConcurrency, retryFetch, type RetryOptions } from "./limits";
import type { DocumentPatchStore } from "./store";

const SNAPSHOT_MAX_BYTES = 1024 * 1024;
const SNAPSHOT_TIMEOUT_MS = 8_000;
const MAX_SAVE_ATTEMPTS = 3;
const MAX_EMBEDS_PER_JOB = 20;

const hostGate = createKeyedGate(1);
const providers: ReadonlySet<string> = new Set(SNAPSHOT_PROVIDERS);

export type EmbedSnapshotDeps = {
  store: DocumentPatchStore;
  concurrency?: number;
  retry?: Partial<RetryOptions>;
  now?: () => Date;
};

export type EmbedSnapshotResult = {
  status: "patched" | "unchanged" | "missing" | "conflict";
  requested: number;
  fetched: number;
};

/**
 * Writes `embed.snapshot` for supported providers. A failed fetch or unparseable response leaves
 * the embed as it was; the block keeps rendering its link-card fallback.
 */
export async function runEmbedSnapshotJob(
  articleId: string,
  deps: EmbedSnapshotDeps,
): Promise<EmbedSnapshotResult> {
  const retry: RetryOptions = { attempts: 3, baseDelayMs: 500, ...deps.retry };
  const now = deps.now ?? (() => new Date());
  const first = await deps.store.load(articleId);
  if (!first) return { status: "missing", requested: 0, fetched: 0 };

  const targets = collectEmbedsToSnapshot(first.document, providers).slice(0, MAX_EMBEDS_PER_JOB);
  if (targets.length === 0) return { status: "unchanged", requested: 0, fetched: 0 };

  const results = await mapWithConcurrency(
    targets,
    deps.concurrency ?? 3,
    async (target): Promise<EmbedSnapshot | null> => {
      if (!isSnapshotProvider(target.provider)) return null;
      const request = snapshotRequest(target.provider, target.url);
      if (!request) return null;
      const fetched = await hostGate.run(new URL(request.url).host, () =>
        retryFetch(
          () =>
            fetchBounded(request.url, {
              accept: request.accept,
              timeoutMs: SNAPSHOT_TIMEOUT_MS,
              maxBytes: SNAPSHOT_MAX_BYTES,
            }),
          retry,
        ),
      );
      if (!fetched.ok) return null;
      const body = new TextDecoder().decode(fetched.value.bytes);
      return parseSnapshot(target.provider, body, now().toISOString());
    },
  );

  const snapshots = new Map<string, EmbedSnapshot>();
  results.forEach((snapshot, index) => {
    if (snapshot) snapshots.set(targets[index]!.url, snapshot);
  });
  if (snapshots.size === 0) return { status: "unchanged", requested: targets.length, fetched: 0 };

  let current: typeof first | null = first;
  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS && current; attempt += 1) {
    const { document, changed } = applyEmbedSnapshots(current.document, snapshots);
    if (!changed)
      return { status: "unchanged", requested: targets.length, fetched: snapshots.size };
    if (await deps.store.save(articleId, document, current.version)) {
      return { status: "patched", requested: targets.length, fetched: snapshots.size };
    }
    current = await deps.store.load(articleId);
  }
  return current
    ? { status: "conflict", requested: targets.length, fetched: snapshots.size }
    : { status: "missing", requested: targets.length, fetched: snapshots.size };
}
