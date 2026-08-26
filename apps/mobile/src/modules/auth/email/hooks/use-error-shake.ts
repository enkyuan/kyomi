import { useCallback, useEffect, useRef, useState } from "react";

export const ERROR_SHAKE_STEP_DURATION_MS = 48;
export const ERROR_SHAKE_STEP_DURATION_SECONDS = ERROR_SHAKE_STEP_DURATION_MS / 1_000;

const ERROR_SHAKE_OFFSETS = [-6, 6, -4, 4, 0] as const;

/**
 * Emits a finite error-feedback timeline. Each renderer interpolates these
 * targets natively, so JavaScript schedules semantic phases rather than frames.
 */
export function useErrorShake(reducedMotion: boolean) {
  const [offset, setOffset] = useState(0);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const cancel = useCallback(() => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];
    setOffset(0);
  }, []);

  const trigger = useCallback(() => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];

    if (reducedMotion) {
      setOffset(0);
      return;
    }

    setOffset(ERROR_SHAKE_OFFSETS[0]);
    for (const [index, nextOffset] of ERROR_SHAKE_OFFSETS.slice(1).entries()) {
      timersRef.current.push(
        setTimeout(
          () => {
            setOffset(nextOffset);
          },
          ERROR_SHAKE_STEP_DURATION_MS * (index + 1),
        ),
      );
    }
  }, [reducedMotion]);

  useEffect(() => cancel, [cancel]);

  useEffect(() => {
    if (reducedMotion) {
      cancel();
    }
  }, [cancel, reducedMotion]);

  return { cancel, offset, trigger };
}
