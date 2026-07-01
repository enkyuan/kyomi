"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COPY_FEEDBACK_DURATION_MS = 1200;

export function useCopyFeedback() {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>> | null>(null);
  resetTimeoutsRef.current ??= new Set();
  const resetTimeouts = resetTimeoutsRef.current;

  const showCopyFeedback = useCallback(() => {
    for (const timeout of resetTimeouts) {
      clearTimeout(timeout);
    }
    resetTimeouts.clear();

    setIsCopied(true);
    const timeout = setTimeout(() => {
      setIsCopied(false);
      resetTimeouts.delete(timeout);
    }, COPY_FEEDBACK_DURATION_MS);
    resetTimeouts.add(timeout);
  }, [resetTimeouts]);

  useEffect(() => {
    return () => {
      for (const timeout of resetTimeouts) {
        clearTimeout(timeout);
      }
      resetTimeouts.clear();
    };
  }, [resetTimeouts]);

  return { isCopied, showCopyFeedback };
}
