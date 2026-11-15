/**
 * Lightweight reader timing, used to compare the DOM WebView reader with the native renderer.
 * Enabled in dev builds, or in any build with `EXPO_PUBLIC_KYOMI_READER_METRICS=1`.
 * Output: one `[reader-metrics]` console line per article open. See `apps/mobile/README.md`.
 */
export type ReaderRenderer = "dom" | "native";

export type ReaderTrace = {
  /** First content has been laid out and is visible. Safe to call repeatedly. */
  ready: () => void;
};

export const READER_METRICS_ENABLED =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  process.env.EXPO_PUBLIC_KYOMI_READER_METRICS === "1";

type HermesInternal = { getInstrumentedStats?: () => Record<string, unknown> };

/** Hermes heap counters if the runtime exposes them. WebView process memory needs Xcode/Android Studio. */
function readHermesHeap(): Record<string, unknown> | undefined {
  const stats = (
    globalThis as { HermesInternal?: HermesInternal }
  ).HermesInternal?.getInstrumentedStats?.();
  if (!stats) return undefined;
  return Object.fromEntries(
    Object.entries(stats).filter(([key]) => /heap|alloc|numGCs/i.test(key)),
  );
}

const NOOP: ReaderTrace = { ready: () => undefined };

export function startReaderTrace(input: {
  articleId: string;
  renderer: ReaderRenderer;
  blocks?: number;
  enabled?: boolean;
  now?: () => number;
  log?: (line: string, payload: unknown) => void;
}): ReaderTrace {
  if (!(input.enabled ?? READER_METRICS_ENABLED)) return NOOP;
  const now = input.now ?? (() => performance.now());
  const log = input.log ?? ((line, payload) => console.info(line, payload));
  const startedAt = now();
  const heapBefore = readHermesHeap();
  let done = false;
  return {
    ready: () => {
      if (done) return;
      done = true;
      log("[reader-metrics]", {
        articleId: input.articleId,
        renderer: input.renderer,
        blocks: input.blocks,
        timeToFirstContentMs: Math.round(now() - startedAt),
        hermesHeapBefore: heapBefore,
        hermesHeapAfter: readHermesHeap(),
      });
    },
  };
}
