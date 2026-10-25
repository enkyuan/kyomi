import type { ReadingProgressUpdateBody } from "@kyomi/reader/schemas/article";
import type { AppStorage } from "@lib/storage";

/** The body of `PUT /api/v1/articles/:articleId/progress`. */
export type ProgressUpdate = ReadingProgressUpdateBody;

export type BufferedProgress = {
  readonly articleId: string;
  readonly body: ProgressUpdate;
  /** Epoch milliseconds at which the write was kept. */
  readonly bufferedAt: number;
};

const BUFFER_KEY = "pending";
/** More than this many articles with unsent progress drops the oldest. */
export const MAX_BUFFERED_ARTICLES = 50;
/** Progress this old is no longer worth restoring or counting. */
export const MAX_BUFFERED_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function isBufferedProgress(value: unknown): value is BufferedProgress {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<BufferedProgress>;
  const body = entry.body as Partial<ProgressUpdate> | undefined;
  return (
    typeof entry.articleId === "string" &&
    typeof entry.bufferedAt === "number" &&
    typeof body === "object" &&
    body !== null &&
    typeof body.clientUpdatedAt === "string" &&
    Number.isFinite(Date.parse(body.clientUpdatedAt))
  );
}

/**
 * Progress writes that could not be sent, kept in app storage with only the latest body for each
 * article. A body is cumulative for its session, so a newer one replaces an older one.
 */
export function createProgressBuffer(storage: AppStorage, now: () => number = Date.now) {
  function read(): Map<string, BufferedProgress> {
    const entries = new Map<string, BufferedProgress>();
    try {
      const parsed: unknown = JSON.parse(storage.getString(BUFFER_KEY) ?? "[]");
      if (!Array.isArray(parsed)) return entries;
      for (const value of parsed) {
        if (isBufferedProgress(value) && now() - value.bufferedAt <= MAX_BUFFERED_AGE_MS) {
          entries.set(value.articleId, value);
        }
      }
    } catch {
      // Unreadable storage is the same as an empty buffer.
    }
    return entries;
  }

  function write(entries: Map<string, BufferedProgress>) {
    const kept = [...entries.values()]
      .sort((a, b) => a.bufferedAt - b.bufferedAt)
      .slice(-MAX_BUFFERED_ARTICLES);
    try {
      if (kept.length === 0) storage.remove(BUFFER_KEY);
      else storage.set(BUFFER_KEY, JSON.stringify(kept));
    } catch {
      // A full or unavailable store loses the write; the next flush carries newer progress.
    }
  }

  const updatedAt = (body: ProgressUpdate) => Date.parse(body.clientUpdatedAt);

  return {
    /** Keeps `body` as the article's pending write unless a newer one is already kept. */
    put(articleId: string, body: ProgressUpdate) {
      const entries = read();
      const current = entries.get(articleId);
      if (current && updatedAt(current.body) > updatedAt(body)) return;
      entries.set(articleId, { articleId, body, bufferedAt: now() });
      write(entries);
    },
    /** Forgets the article's pending write once `body`, or something newer, has been sent. */
    remove(articleId: string, body: ProgressUpdate) {
      const entries = read();
      const current = entries.get(articleId);
      if (!current || updatedAt(current.body) > updatedAt(body)) return;
      entries.delete(articleId);
      write(entries);
    },
    /** Pending writes, oldest first. */
    list(): BufferedProgress[] {
      return [...read().values()].sort((a, b) => a.bufferedAt - b.bufferedAt);
    },
  };
}

export type ProgressBuffer = ReturnType<typeof createProgressBuffer>;
