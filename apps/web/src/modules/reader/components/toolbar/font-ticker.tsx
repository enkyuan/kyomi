"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

function useTickerDirection(value: number) {
  const previousValueRef = useRef(value);
  const direction =
    value > previousValueRef.current ? 1 : value < previousValueRef.current ? -1 : 0;

  useEffect(() => {
    previousValueRef.current = value;
  }, [value]);

  return direction;
}

export function FontSizeTicker({ value }: { value: number }) {
  const prefersReducedMotion = useReducedMotion();
  const direction = useTickerDirection(value);
  const valueText = String(value);
  const digits = valueText.split("").map((digit, offset) => ({
    digit,
    place: valueText.length - offset,
  }));

  return (
    <LazyMotion features={domAnimation}>
      <span
        aria-label={`Font size ${value}`}
        className="flex min-w-7 items-center justify-center px-0.5 text-xs font-medium leading-none text-muted-foreground tabular-nums"
      >
        {digits.map(({ digit, place }) => (
          <span
            key={`font-size-place-${place}`}
            aria-hidden
            className="relative inline-block h-4 w-[0.62em] overflow-hidden"
          >
            <AnimatePresence initial={false} mode="popLayout">
              <m.span
                key={`${digit}-${place}`}
                className="absolute inset-0 flex items-center justify-center"
                initial={
                  prefersReducedMotion || direction === 0
                    ? false
                    : { opacity: 0, y: direction > 0 ? 8 : -8 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  prefersReducedMotion || direction === 0
                    ? undefined
                    : { opacity: 0, y: direction > 0 ? -8 : 8 }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", duration: 0.24, bounce: 0 }
                }
              >
                {digit}
              </m.span>
            </AnimatePresence>
          </span>
        ))}
      </span>
    </LazyMotion>
  );
}
