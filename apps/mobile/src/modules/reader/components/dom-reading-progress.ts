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

type Timer = ReturnType<typeof setTimeout>;

/**
 * Throttles scroll samples: one at most every `READING_SAMPLE_INTERVAL_MS`, a trailing one for the
 * scrolls in between, and a last one once scrolling stops. `report` returns whether it sent a sample.
 * The timers live here, not in the effect, so `dispose` is the one place that releases them.
 */
function createScrollSampler(report: () => boolean) {
  let lastEmitAt = 0;
  let trailing: Timer | undefined;
  let scrollEnd: Timer | undefined;

  const emit = () => {
    if (report()) lastEmitAt = Date.now();
  };
  const onScroll = () => {
    const wait = READING_SAMPLE_INTERVAL_MS - (Date.now() - lastEmitAt);
    if (wait <= 0) {
      emit();
    } else if (trailing === undefined) {
      trailing = setTimeout(() => {
        trailing = undefined;
        emit();
      }, wait);
    }
    clearTimeout(scrollEnd);
    scrollEnd = setTimeout(emit, READING_SCROLL_END_MS);
  };
  const dispose = () => {
    clearTimeout(trailing);
    clearTimeout(scrollEnd);
  };
  return { dispose, emit, onScroll };
}

/**
 * Decides when a restore has settled: after the article stops being corrected for
 * `RESTORE_QUIET_MS`, or at `RESTORE_CAP_MS` if it never goes quiet. Each correction calls `arm`.
 */
function createRestoreSettler(onSettled: () => void) {
  let settled = false;
  let quiet: Timer | undefined;
  const dispose = () => {
    clearTimeout(quiet);
    clearTimeout(cap);
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    dispose();
    onSettled();
  };
  const cap = setTimeout(finish, RESTORE_CAP_MS);
  const arm = () => {
    clearTimeout(quiet);
    quiet = setTimeout(finish, RESTORE_QUIET_MS);
  };
  return { arm, dispose };
}

/** Calls `onResize` while the element resizes, for `durationMs`; the returned function stops it. */
function observeResizes(element: Element, onResize: () => void, durationMs: number) {
  const observer = new ResizeObserver(onResize);
  observer.observe(element);
  const stop = setTimeout(() => observer.disconnect(), durationMs);
  return () => {
    observer.disconnect();
    clearTimeout(stop);
  };
}

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

    const sampler = createScrollSampler(() => {
      const report = reportRef.current;
      if (state.held || !report) return false;
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
      report({ completed, progress });
      return true;
    });
    state.emit = sampler.emit;

    const onUserInput = () => {
      state.userScrolled = true;
    };

    // One signal owns every listener, so a single abort removes them all.
    const listeners = new AbortController();
    window.addEventListener("scroll", sampler.onScroll, {
      passive: true,
      signal: listeners.signal,
    });
    for (const type of ["touchstart", "wheel", "keydown"] as const) {
      window.addEventListener(type, onUserInput, {
        capture: true,
        passive: true,
        signal: listeners.signal,
      });
    }
    return () => {
      listeners.abort();
      sampler.dispose();
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

    const settler = createRestoreSettler(() => settledRef.current?.());
    const restoreAndArm = () => {
      restore();
      settler.arm();
    };

    restoreAndArm();
    const stopObserving = observeResizes(article, restoreAndArm, RESTORE_SETTLE_MS);
    return () => {
      stopObserving();
      settler.dispose();
    };
  }, [articleRef, initialProgress]);
}
