import type { ReadingProgressDto } from "@kyomi/reader/schemas/article";
import type { ProgressBuffer, ProgressUpdate } from "./progress-buffer";

export type ReadingProgressResult = ReadingProgressDto;

export type SendProgress = (
  articleId: string,
  body: ProgressUpdate,
) => Promise<ReadingProgressResult>;

/**
 * A rejected write that will never succeed, such as an article that no longer exists. Network
 * failures (status 0), a signed-out session, throttling and server errors are worth retrying.
 */
export function isPermanentFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 401 &&
    status !== 408 &&
    status !== 429
  );
}

/** Sends progress writes and keeps the ones that fail so the next app foreground can retry them. */
export function createProgressSync({
  buffer,
  send,
}: {
  readonly buffer: ProgressBuffer;
  readonly send: SendProgress;
}) {
  let retrying: Promise<number> | null = null;
  // Bumped by `reset`: a write that started under an earlier account must not be sent, kept or
  // retried once another account may be signed in.
  let epoch = 0;

  /**
   * `sent`, `dropped` (never retry) or `kept` (retry later). A new write that fails is buffered; a
   * buffered one that fails again stays where it is, so retries keep their order and age.
   */
  async function attempt(articleId: string, body: ProgressUpdate, isBuffered: boolean) {
    const startedIn = epoch;
    try {
      const result = await send(articleId, body);
      if (startedIn !== epoch) return { outcome: "dropped" as const, result: null };
      buffer.remove(articleId, body);
      return { outcome: "sent" as const, result };
    } catch (error) {
      if (startedIn !== epoch) return { outcome: "dropped" as const, result: null };
      if (isPermanentFailure(error)) {
        buffer.remove(articleId, body);
        return { outcome: "dropped" as const, result: null };
      }
      if (!isBuffered) buffer.put(articleId, body);
      return { outcome: "kept" as const, result: null };
    }
  }

  async function retryAll() {
    const startedIn = epoch;
    let sent = 0;
    for (const entry of buffer.list()) {
      if (startedIn !== epoch) break;
      const { outcome } = await attempt(entry.articleId, entry.body, true);
      if (outcome === "sent") sent += 1;
      // The network is down or the session ended: the rest would fail the same way.
      else if (outcome === "kept") break;
    }
    return sent;
  }

  return {
    /** The server's progress for the article, or null when the write was kept or dropped. */
    async push(articleId: string, body: ProgressUpdate): Promise<ReadingProgressResult | null> {
      return (await attempt(articleId, body, false)).result;
    },
    /** Forgets every kept write and stops any retry or send in flight from touching the buffer or the network again. */
    reset(): void {
      epoch += 1;
      retrying = null;
      buffer.clear();
    },
    /** Sends every kept write once; calls made while one is running share it. Resolves to the count sent. */
    retryBuffered(): Promise<number> {
      if (!retrying) {
        const run = retryAll().finally(() => {
          if (retrying === run) retrying = null;
        });
        retrying = run;
      }
      return retrying;
    },
  };
}

export type ProgressSync = ReturnType<typeof createProgressSync>;
