"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_FEEDBACK_DURATION_MS = 1200;

export function useFeedback({ durationMs = DEFAULT_FEEDBACK_DURATION_MS } = {}) {
  const [isActive, setIsActive] = useState(false);
  const resetTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>> | null>(null);
  resetTimeoutsRef.current ??= new Set();
  const resetTimeouts = resetTimeoutsRef.current;

  const resetFeedback = useCallback(() => {
    for (const timeout of resetTimeouts) {
      clearTimeout(timeout);
    }
    resetTimeouts.clear();

    setIsActive(false);
  }, [resetTimeouts]);

  const showFeedback = useCallback(() => {
    resetFeedback();
    setIsActive(true);
    const timeout = setTimeout(() => {
      setIsActive(false);
      resetTimeouts.delete(timeout);
    }, durationMs);
    resetTimeouts.add(timeout);
  }, [durationMs, resetFeedback, resetTimeouts]);

  useEffect(() => {
    return resetFeedback;
  }, [resetFeedback]);

  return { isActive, resetFeedback, showFeedback };
}
