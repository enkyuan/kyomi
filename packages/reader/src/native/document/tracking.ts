import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  READING_SAMPLE_INTERVAL_MS,
  READING_SCROLL_END_MS,
  progressFromScroll,
  scrollTopForProgress,
} from "../../core/progress";

/** How long after first layout a restore keeps correcting as virtualized rows report real heights. */
const RESTORE_SETTLE_MS = 4_000;
const END_SLACK_PX = 2;
/**
 * A restore is settled once the list has stopped changing size for this long, or this long after it
 * began, whichever comes first. Until then the screen keeps its skeleton up, so the corrections a
 * virtualized list makes as rows report real heights happen out of sight instead of as visible jumps.
 */
const RESTORE_QUIET_MS = 150;
const RESTORE_CAP_MS = 800;

export type NativeReadingSample = {
  readonly progress: number;
  readonly completed: boolean;
};

type ScrollTarget = { scrollToOffset: (params: { animated?: boolean; offset: number }) => void };

type UseReadingTrackingInput = {
  /** Space under the last block, which is scroll content but not part of the article body. */
  bottomInset: number;
  /** Restore to this progress (0..1) once laid out, unless the reader has already scrolled. */
  initialProgress: number | undefined;
  listRef: RefObject<ScrollTarget | null>;
  onReadingProgress: ((sample: NativeReadingSample) => void) | undefined;
  /** The restore has landed and the list has stopped moving; nothing is called without a restore. */
  onRestoreSettled?: () => void;
};

/**
 * Reports reading progress for a virtualized list and restores `initialProgress`, with the same
 * measures as the DOM reader: the article body excludes the header above it, the reading line sits
 * a quarter of the way down the viewport, and the end of the body counts as completed.
 *
 * Samples are throttled to `READING_SAMPLE_INTERVAL_MS` while scrolling and sent once more when the
 * scroll settles. While a restore is pending nothing is reported, so a position is never overwritten
 * by the top of the article the reader has not left yet.
 */
export function useReadingTracking({
  bottomInset,
  initialProgress,
  listRef,
  onReadingProgress,
  onRestoreSettled,
}: UseReadingTrackingInput) {
  const reportRef = useRef(onReadingProgress);
  const bottomInsetRef = useRef(bottomInset);
  const initialRef = useRef(initialProgress);
  const settledRef = useRef(onRestoreSettled);
  useEffect(() => {
    settledRef.current = onRestoreSettled;
    reportRef.current = onReadingProgress;
    bottomInsetRef.current = bottomInset;
    initialRef.current = initialProgress;
  }, [bottomInset, initialProgress, onReadingProgress]);

  const metrics = useRef({ content: 0, header: 0, scrollY: 0, viewport: 0 });
  const state = useRef({
    held: initialProgress !== undefined,
    lastEmitAt: 0,
    restoreUntil: 0,
    userScrolled: false,
  });
  const settle = useRef<{
    cap?: ReturnType<typeof setTimeout>;
    done: boolean;
    quiet?: ReturnType<typeof setTimeout>;
  }>({ done: false });
  const timers = useRef<{
    end?: ReturnType<typeof setTimeout>;
    trailing?: ReturnType<typeof setTimeout>;
  }>({});

  const bodyGeometry = useCallback(() => {
    const { content, header } = metrics.current;
    const bodyBottom = content - bottomInsetRef.current;
    return { bodyBottom, contentHeight: Math.max(0, bodyBottom - header), contentTop: header };
  }, []);

  const emit = useCallback(() => {
    const report = reportRef.current;
    const { scrollY, viewport } = metrics.current;
    if (state.current.held || !report || viewport <= 0) return;
    const { bodyBottom, contentHeight, contentTop } = bodyGeometry();
    state.current.lastEmitAt = Date.now();
    report({
      // The reading line never reaches the end of the body, so the end is checked directly.
      completed: scrollY > 0 && scrollY + viewport >= bodyBottom - END_SLACK_PX,
      progress: progressFromScroll({
        contentHeight,
        contentTop,
        scrollTop: scrollY,
        viewportHeight: viewport,
      }),
    });
  }, [bodyGeometry]);

  const finishRestore = useCallback(() => {
    const pending = settle.current;
    if (pending.done) return;
    pending.done = true;
    clearTimeout(pending.quiet);
    clearTimeout(pending.cap);
    settledRef.current?.();
  }, []);

  /** Each correction re-arms the quiet timer; the cap bounds the wait if the list never goes quiet. */
  const armSettle = useCallback(() => {
    const pending = settle.current;
    if (pending.done) return;
    clearTimeout(pending.quiet);
    pending.quiet = setTimeout(finishRestore, RESTORE_QUIET_MS);
    pending.cap ??= setTimeout(finishRestore, RESTORE_CAP_MS);
  }, [finishRestore]);

  const restore = useCallback(() => {
    const target = initialRef.current;
    const { content, viewport } = metrics.current;
    if (target === undefined) return;
    if (state.current.userScrolled) {
      finishRestore();
      return;
    }
    if (viewport <= 0 || content <= 0) return;

    const now = Date.now();
    if (state.current.restoreUntil === 0) state.current.restoreUntil = now + RESTORE_SETTLE_MS;
    if (now > state.current.restoreUntil && !state.current.held) return;

    const { contentHeight, contentTop } = bodyGeometry();
    const offset = scrollTopForProgress(target, {
      contentHeight,
      contentTop,
      viewportHeight: viewport,
    });
    listRef.current?.scrollToOffset({ animated: false, offset });
    metrics.current.scrollY = offset;
    armSettle();
    if (state.current.held) {
      state.current.held = false;
      emit();
    }
  }, [armSettle, bodyGeometry, emit, finishRestore, listRef]);

  useEffect(() => {
    // Nothing to restore: the first scroll is the first sample.
    if (initialProgress === undefined) state.current.held = false;
  }, [initialProgress]);

  useEffect(() => {
    const pending = timers.current;
    const restoring = settle.current;
    return () => {
      clearTimeout(pending.trailing);
      clearTimeout(pending.end);
      clearTimeout(restoring.quiet);
      clearTimeout(restoring.cap);
    };
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      metrics.current.scrollY = event.nativeEvent.contentOffset.y;
      const wait = READING_SAMPLE_INTERVAL_MS - (Date.now() - state.current.lastEmitAt);
      if (wait <= 0) {
        emit();
      } else if (timers.current.trailing === undefined) {
        timers.current.trailing = setTimeout(() => {
          timers.current.trailing = undefined;
          emit();
        }, wait);
      }
      clearTimeout(timers.current.end);
      timers.current.end = setTimeout(emit, READING_SCROLL_END_MS);
    },
    [emit],
  );

  return {
    onContentSizeChange: useCallback(
      (_width: number, height: number) => {
        metrics.current.content = height;
        restore();
      },
      [restore],
    ),
    onHeaderLayout: useCallback(
      (event: LayoutChangeEvent) => {
        metrics.current.header = event.nativeEvent.layout.height;
        restore();
      },
      [restore],
    ),
    onLayout: useCallback(
      (event: LayoutChangeEvent) => {
        metrics.current.viewport = event.nativeEvent.layout.height;
        restore();
      },
      [restore],
    ),
    onScroll,
    onScrollBeginDrag: useCallback(() => {
      state.current.userScrolled = true;
    }, []),
  };
}
