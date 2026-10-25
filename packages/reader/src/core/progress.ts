import type { ReadingProgressDto, ReadingProgressUpdateBody } from "../schemas/article";
import type { ReaderContent } from "./types";

export const READING_FLUSH_INTERVAL_MS = 10_000;
export const READING_IDLE_TIMEOUT_MS = 30_000;
export const READING_COMPLETE_THRESHOLD = 0.9;
/** The reading line sits this far down the viewport. */
export const READING_LINE_RATIO = 0.25;

const CONTENT_KEY_MAX_LENGTH = 128;

export type ScrollMetrics = {
  scrollTop: number;
  viewportHeight: number;
  /** Offset of the article body within the scroll content. */
  contentTop: number;
  contentHeight: number;
};

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Position of the reading line within the article body, clamped to 0..1.
 *
 * The reading line sits `READING_LINE_RATIO` down the viewport. A body that ends exactly at the end
 * of the scroll content never lifts the line to 1, so callers report the end separately through
 * `completed`.
 */
export function progressFromScroll(metrics: ScrollMetrics): number {
  const contentHeight = finiteOr(metrics.contentHeight, 0);
  if (contentHeight <= 0) {
    return 0;
  }
  const readingLine =
    finiteOr(metrics.scrollTop, 0) + finiteOr(metrics.viewportHeight, 0) * READING_LINE_RATIO;
  return clamp01((readingLine - finiteOr(metrics.contentTop, 0)) / contentHeight);
}

/**
 * Inverse of `progressFromScroll`: the scroll offset that puts the reading line at `progress`.
 * The result is never negative, which is the only clamp the inverse applies.
 */
export function scrollTopForProgress(
  progress: number,
  metrics: Omit<ScrollMetrics, "scrollTop">,
): number {
  const contentHeight = Math.max(0, finiteOr(metrics.contentHeight, 0));
  const readingLine = finiteOr(metrics.contentTop, 0) + clamp01(progress) * contentHeight;
  return Math.max(0, readingLine - finiteOr(metrics.viewportHeight, 0) * READING_LINE_RATIO);
}

/**
 * A restore applies the stored position only when this key matches the content being rendered.
 * `ReaderContent` does not carry a sanitizer version today; one is used when present.
 */
export function buildContentKey(reader: ReaderContent): string {
  const { sanitizerVersion } = reader as ReaderContent & { sanitizerVersion?: string | null };
  const source = reader.contentSource ?? reader.bodyKind;
  return `${source}:${sanitizerVersion || "none"}`.slice(0, CONTENT_KEY_MAX_LENGTH);
}

export type ActiveTimer = {
  markActivity(): void;
  setVisible(visible: boolean): void;
  elapsedMs(): number;
};

/**
 * Accumulates reading time only while visible and within `READING_IDLE_TIMEOUT_MS` of the last
 * activity. Becoming visible counts as activity.
 */
export function createActiveTimer(now: () => number = Date.now): ActiveTimer {
  let visible = true;
  let accruedMs = 0;
  let cursor = now();
  let lastActivityAt = cursor;

  function advance(): number {
    const current = now();
    if (current <= cursor) {
      return current;
    }
    if (visible) {
      const activeUntil = lastActivityAt + READING_IDLE_TIMEOUT_MS;
      accruedMs += Math.max(0, Math.min(current, activeUntil) - cursor);
    }
    cursor = current;
    return current;
  }

  return {
    markActivity() {
      lastActivityAt = Math.max(lastActivityAt, advance());
    },
    setVisible(next) {
      const current = advance();
      if (next && !visible) {
        lastActivityAt = Math.max(lastActivityAt, current);
      }
      visible = next;
    },
    elapsedMs() {
      advance();
      return accruedMs;
    },
  };
}

export type ReadingSession = {
  readonly sessionId: string;
  sample(input: { progress: number; completed?: boolean }): void;
  /** The body to send, or null when nothing changed since the last flush. */
  takeUpdate(): ReadingProgressUpdateBody | null;
};

function randomHex(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

function createSessionId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  // React Native engines may not ship crypto.randomUUID; build a v4 UUID.
  const variant = "89ab"[Math.floor(Math.random() * 4)];
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${variant}${randomHex(3)}-${randomHex(12)}`;
}

export function createReadingSession(input: {
  contentKey: string;
  timer: ActiveTimer;
  now?: () => number;
  createId?: () => string;
}): ReadingSession {
  const now = input.now ?? Date.now;
  const sessionId = (input.createId ?? createSessionId)();
  let sampled = false;
  let progress = 0;
  let completed = false;
  let lastSent: { progress: number; completed: boolean; activeMs: number } | null = null;

  return {
    sessionId,
    sample(sample) {
      sampled = true;
      progress = clamp01(sample.progress);
      completed = completed || sample.completed === true;
    },
    takeUpdate() {
      if (!sampled) {
        return null;
      }
      const activeMs = Math.max(0, Math.floor(input.timer.elapsedMs()));
      if (
        lastSent &&
        lastSent.progress === progress &&
        lastSent.completed === completed &&
        lastSent.activeMs === activeMs
      ) {
        return null;
      }
      lastSent = { progress, completed, activeMs };
      return {
        progress,
        anchor: null,
        contentKey: input.contentKey,
        sessionId,
        sessionActiveMs: activeMs,
        completed,
        clientUpdatedAt: new Date(now()).toISOString(),
      };
    },
  };
}

/** Both clients use this for their Continue reading badge. */
export function isContinuingReading(progress: ReadingProgressDto | null | undefined): boolean {
  if (!progress?.engaged) {
    return false;
  }
  return progress.state === "reading" || progress.state === "resurfacing";
}

/** "6 min left", or "Under 1 min left" below a minute. Null when the estimate is unknown. */
export function formatRemainingMinutes(minutes: number | null): string | null {
  if (minutes === null || !Number.isFinite(minutes)) {
    return null;
  }
  if (minutes < 1) {
    return "Under 1 min left";
  }
  return `${Math.round(minutes)} min left`;
}
