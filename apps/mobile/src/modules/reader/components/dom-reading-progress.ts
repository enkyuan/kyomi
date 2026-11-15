import { useEffect, useRef, type RefObject } from "react";
import {
  READING_SAMPLE_INTERVAL_MS,
  READING_SCROLL_END_MS,
  progressFromScroll,
  scrollTopForProgress,
} from "@kyomi/reader/core";

/** Images and fonts keep resizing the body after first layout; a restore follows them this long. */
const RESTORE_SETTLE_MS = 4_000;
/** The restore counts as settled once the article stops resizing for this long, or after the cap. */
const RESTORE_QUIET_MS = 150;
const RESTORE_CAP_MS = 800;

type ReadingTracking = {
  /** Samples wait for a pending restore so the top of the article never overwrites a saved position. */
  held: boolean;
  userScrolled: boolean;
  emit: () => void;
};

/**
 * Restores `initialProgress` and reports reading progress. The page scrolls inside its own WebView,
 * so scroll position, viewport and article geometry are read here and only samples cross the bridge.
 */
export function useReadingProgressTracking(
  articleRef: RefObject<HTMLElement | null>,
  initialProgress: number | undefined,
  onReadingProgress: ((sample: { progress: number; completed: boolean }) => void) | undefined,
  /** Called once a restore has landed and the article has stopped resizing. */
  onRestoreSettled?: () => void,
) {
  const settledRef = useRef(onRestoreSettled);
  useEffect(() => {
    settledRef.current = onRestoreSettled;
  }, [onRestoreSettled]);
  const reportRef = useRef(onReadingProgress);
  useEffect(() => {
    reportRef.current = onReadingProgress;
  }, [onReadingProgress]);
  const tracking = useRef<ReadingTracking>({
    emit: () => undefined,
    held: initialProgress !== undefined,
    userScrolled: false,
  });

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const state = tracking.current;

    let lastEmitAt = 0;
    let trailing: number | undefined;
    let scrollEnd: number | undefined;

    const emit = () => {
      if (state.held || !reportRef.current) return;
      const scrollTop = window.scrollY;
      const progress = progressFromScroll({
        contentHeight: article.offsetHeight,
        contentTop: article.getBoundingClientRect().top + scrollTop,
        scrollTop,
        viewportHeight: window.innerHeight,
      });
      // The reading line never reaches the end of the body, so the end is checked directly: the
      // last of the article is on screen after the reader has scrolled.
      const completed =
        scrollTop > 0 && article.getBoundingClientRect().bottom <= window.innerHeight + 2;
      lastEmitAt = Date.now();
      reportRef.current({ completed, progress });
    };
    state.emit = emit;

    const onScroll = () => {
      const wait = READING_SAMPLE_INTERVAL_MS - (Date.now() - lastEmitAt);
      if (wait <= 0) {
        emit();
      } else {
        if (trailing === undefined) {
          trailing = window.setTimeout(() => {
            trailing = undefined;
            emit();
          }, wait);
        }
      }
      window.clearTimeout(scrollEnd);
      scrollEnd = window.setTimeout(emit, READING_SCROLL_END_MS);
    };
    const onUserInput = () => {
      state.userScrolled = true;
    };

    // One signal owns every listener, so a single abort removes them all.
    const listeners = new AbortController();
    window.addEventListener("scroll", onScroll, { passive: true, signal: listeners.signal });
    for (const type of ["touchstart", "wheel", "keydown"] as const) {
      window.addEventListener(type, onUserInput, {
        capture: true,
        passive: true,
        signal: listeners.signal,
      });
    }
    return () => {
      listeners.abort();
      window.clearTimeout(trailing);
      window.clearTimeout(scrollEnd);
      state.emit = () => undefined;
    };
  }, [articleRef]);

  useEffect(() => {
    const article = articleRef.current;
    const state = tracking.current;
    if (!article) return;

    if (initialProgress === undefined) {
      // Nothing to restore: the first scroll is the first sample.
      state.held = false;
      return;
    }
    if (state.userScrolled) return;

    const restore = () => {
      if (state.userScrolled) return;
      const top = scrollTopForProgress(initialProgress, {
        contentHeight: article.offsetHeight,
        contentTop: article.getBoundingClientRect().top + window.scrollY,
        viewportHeight: window.innerHeight,
      });
      window.scrollTo({ behavior: "instant", top });
      if (state.held) {
        state.held = false;
        state.emit();
      }
    };

    let settled = false;
    let quiet: number | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(quiet);
      window.clearTimeout(cap);
      settledRef.current?.();
    };
    // Each correction re-arms the quiet timer; the cap bounds the wait if the article never goes quiet.
    const arm = () => {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(finish, RESTORE_QUIET_MS);
    };
    const cap = window.setTimeout(finish, RESTORE_CAP_MS);
    const restoreAndArm = () => {
      restore();
      arm();
    };

    restoreAndArm();
    const observer = new ResizeObserver(restoreAndArm);
    observer.observe(article);
    const stop = window.setTimeout(() => observer.disconnect(), RESTORE_SETTLE_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(stop);
      window.clearTimeout(quiet);
      window.clearTimeout(cap);
    };
  }, [articleRef, initialProgress]);
}
