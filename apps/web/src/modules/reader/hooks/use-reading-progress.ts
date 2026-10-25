"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type RefObject } from "react";
import {
  READING_FLUSH_INTERVAL_MS,
  createActiveTimer,
  createReadingSession,
  progressFromScroll,
  scrollTopForProgress,
} from "@kyomi/reader/core";
import type { ReadingPositionDto } from "@kyomi/reader/schemas/article";
import { saveReadingProgress } from "@modules/articles/lib/api";
import { updateReadingProgressCaches } from "@modules/articles/queries/cache";
import { findReaderBody, measureReaderBody } from "@modules/reader/lib/progress";

/** Scrolls this soon after our own `scrollTo` are not the reader's activity. */
const PROGRAMMATIC_SCROLL_WINDOW_MS = 120;
/** Frames to wait for the article body to lay out before giving up on a restore. */
const RESTORE_MAX_FRAMES = 60;
/** Quiet time after the last image load or resize before the single re-apply. */
const RESTORE_SETTLE_DEBOUNCE_MS = 150;
/** The restore stops watching for late layout after this long. */
const RESTORE_SETTLE_MAX_MS = 3_000;

const ACTIVITY_EVENTS = ["wheel", "keydown", "pointerdown", "touchstart", "touchmove"] as const;
const USER_SCROLL_INTENT_EVENTS = ["wheel", "keydown", "pointerdown", "touchstart"] as const;

/**
 * Server functions are plain `fetch` calls, so a request started when the page is hidden can be
 * cancelled by the browser tearing the page down. `keepalive` lets that one survive.
 */
const keepaliveFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, keepalive: true })) as typeof fetch;

type ReadingProgressInput = {
  viewportRef: RefObject<HTMLElement | null>;
  itemId: string | undefined;
  /** `buildContentKey` of the reader content being rendered. */
  contentKey: string | undefined;
  readingPosition: ReadingPositionDto | null | undefined;
  /** The "Remember reading position" preference. Off means no tracking and no restore. */
  enabled: boolean;
};

function sendProgress({
  queryClient,
  itemId,
  body,
  keepalive,
}: {
  queryClient: QueryClient;
  itemId: string;
  body: NonNullable<ReturnType<ReturnType<typeof createReadingSession>["takeUpdate"]>>;
  keepalive: boolean;
}) {
  saveReadingProgress({ data: { itemId, body }, fetch: keepalive ? keepaliveFetch : undefined })
    .then(({ readingProgress }) => {
      updateReadingProgressCaches(queryClient, itemId, {
        readingProgress,
        readingPosition: {
          progress: body.progress,
          anchor: body.anchor,
          contentKey: body.contentKey,
          updatedAt: body.clientUpdatedAt,
        },
      });
    })
    // Best effort: the next flush resends the cumulative session state, and a write lost on the
    // final flush only costs the last few seconds of position.
    .catch(() => undefined);
}

/**
 * Opens the article at the right scroll offset and tracks reading progress for it.
 *
 * The scroll offset is the restored position when the preference is on and a stored position for
 * the same content exists, otherwise the top. Tracking samples the reading line on scroll, counts
 * active time, and flushes every `READING_FLUSH_INTERVAL_MS`, on article change and when the page
 * becomes hidden. It measures only the viewport and the `data-reader-body` wrapper, so it does not
 * depend on how the body is rendered.
 */
export function useReadingProgress({
  viewportRef,
  itemId,
  contentKey,
  readingPosition,
  enabled,
}: ReadingProgressInput) {
  const queryClient = useQueryClient();
  const latest = useRef({ contentKey, enabled, readingPosition });
  const ignoreActivityUntil = useRef(0);

  useEffect(() => {
    latest.current = { contentKey, enabled, readingPosition };
  });

  // Open position: restore, or start at the top. Runs once per article, never on a mode switch.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !itemId) {
      return;
    }

    const { contentKey: key, enabled: remember, readingPosition: position } = latest.current;
    const restoreProgress =
      remember && position && key !== undefined && position.contentKey === key
        ? position.progress
        : null;

    const scrollTo = (top: number) => {
      ignoreActivityUntil.current = Date.now() + PROGRAMMATIC_SCROLL_WINDOW_MS;
      viewport.scrollTo({ top });
    };

    scrollTo(0);
    if (restoreProgress === null || restoreProgress <= 0) {
      return;
    }

    let frames = 0;
    let frameId: number | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let userScrolled = false;
    let reapplied = false;

    const apply = () => {
      const metrics = measureReaderBody(viewport, itemId);
      if (!metrics) {
        return false;
      }
      scrollTo(scrollTopForProgress(restoreProgress, metrics));
      return true;
    };

    const stopWatching = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      viewport.removeEventListener("load", scheduleReapply, true);
      if (settleTimer !== null) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      if (stopTimer !== null) {
        clearTimeout(stopTimer);
        stopTimer = null;
      }
    };

    // Re-apply once after images and late layout settle, unless the reader already moved.
    function scheduleReapply() {
      if (reapplied || userScrolled) {
        return;
      }
      if (settleTimer !== null) {
        clearTimeout(settleTimer);
      }
      settleTimer = setTimeout(() => {
        settleTimer = null;
        reapplied = true;
        if (!userScrolled) {
          apply();
        }
        stopWatching();
      }, RESTORE_SETTLE_DEBOUNCE_MS);
    }

    const startWatching = () => {
      const body = findReaderBody(viewport, itemId);
      if (body && typeof ResizeObserver !== "undefined") {
        // The first callback is the initial observation, not a layout change.
        let initial = true;
        resizeObserver = new ResizeObserver(() => {
          if (initial) {
            initial = false;
            return;
          }
          scheduleReapply();
        });
        resizeObserver.observe(body);
      }
      viewport.addEventListener("load", scheduleReapply, true);
      stopTimer = setTimeout(stopWatching, RESTORE_SETTLE_MAX_MS);
    };

    const markUserScrolled = () => {
      userScrolled = true;
      stopWatching();
    };
    for (const type of USER_SCROLL_INTENT_EVENTS) {
      viewport.addEventListener(type, markUserScrolled, { passive: true });
    }

    const waitForBody = () => {
      frameId = null;
      if (userScrolled) {
        return;
      }
      if (apply()) {
        startWatching();
        return;
      }
      frames += 1;
      if (frames < RESTORE_MAX_FRAMES) {
        frameId = window.requestAnimationFrame(waitForBody);
      }
    };
    waitForBody();

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      stopWatching();
      for (const type of USER_SCROLL_INTENT_EVENTS) {
        viewport.removeEventListener(type, markUserScrolled);
      }
    };
  }, [itemId, viewportRef]);

  // Tracking: one session per article open and content key.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!enabled || !viewport || !itemId || !contentKey) {
      return;
    }

    const timer = createActiveTimer();
    const session = createReadingSession({ contentKey, timer });
    let frameId: number | null = null;

    const flush = (keepalive = false) => {
      const body = session.takeUpdate();
      if (body) {
        sendProgress({ queryClient, itemId, body, keepalive });
      }
    };

    const sample = () => {
      frameId = null;
      const metrics = measureReaderBody(viewport, itemId);
      if (metrics) {
        session.sample({ progress: progressFromScroll(metrics), completed: metrics.endVisible });
      }
    };

    const handleScroll = () => {
      if (Date.now() >= ignoreActivityUntil.current) {
        timer.markActivity();
      }
      if (frameId === null) {
        frameId = window.requestAnimationFrame(sample);
      }
    };
    const handleActivity = () => timer.markActivity();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        timer.setVisible(false);
        flush(true);
        return;
      }
      timer.setVisible(true);
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    for (const type of ACTIVITY_EVENTS) {
      viewport.addEventListener(type, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);
    const intervalId = setInterval(() => {
      if (document.visibilityState !== "hidden") {
        flush();
      }
    }, READING_FLUSH_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      viewport.removeEventListener("scroll", handleScroll);
      for (const type of ACTIVITY_EVENTS) {
        viewport.removeEventListener(type, handleActivity);
      }
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      flush();
    };
  }, [contentKey, enabled, itemId, queryClient, viewportRef]);
}
